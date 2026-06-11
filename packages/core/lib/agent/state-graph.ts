import { logger } from '../logger';

export type StateUpdate<T> = Partial<T> | Promise<Partial<T>>;
export type NodeFunction<T> = (state: T) => StateUpdate<T>;
export type RoutingFunction<T> = (state: T) => string | Promise<string>;

export interface StateGraphNode<T> {
  name: string;
  fn: NodeFunction<T>;
}

export interface StateGraphEdge {
  from: string;
  to: string;
}

export interface ConditionalEdge<T> {
  from: string;
  router: RoutingFunction<T>;
  pathMap: Record<string, string>;
}

export interface Checkpoint<T> {
  threadId: string;
  state: T;
  step: number;
  timestamp: number;
  currentNode: string;
}

export interface Checkpointer<T> {
  saveCheckpoint(checkpoint: Checkpoint<T>): Promise<void>;
  loadCheckpoint(threadId: string): Promise<Checkpoint<T> | null>;
}

export interface StateGraphOptions<T> {
  checkpointer?: Checkpointer<T>;
  interruptNodes?: string[]; // Pauses execution *before* running these nodes
}

export const END = '__END__';

/**
 * Native event-driven StateGraph orchestrator inspired by LangGraph.
 * Lightweight, type-safe, and highly performant for serverless/edge environments.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class StateGraph<T extends Record<string, any>> {
  private nodes: Map<string, NodeFunction<T>> = new Map();
  private edges: Map<string, string> = new Map();
  private conditionalEdges: Map<string, ConditionalEdge<T>> = new Map();
  private entryPoint: string | null = null;
  private reducer: (state: T, update: Partial<T>) => T;

  constructor(defaultState: T, reducer?: (state: T, update: Partial<T>) => T) {
    this.reducer = reducer || ((state, update) => ({ ...state, ...update }));
  }

  /**
   * Adds a node (executable function/agent step) to the graph.
   */
  addNode(name: string, fn: NodeFunction<T>): this {
    if (this.nodes.has(name)) {
      throw new Error(`Node "${name}" already exists in StateGraph`);
    }
    this.nodes.set(name, fn);
    return this;
  }

  /**
   * Defines a direct flow/edge from one node to another.
   */
  addEdge(from: string, to: string): this {
    if (from === END) {
      throw new Error(`Cannot define an edge starting from END node`);
    }
    this.edges.set(from, to);
    return this;
  }

  /**
   * Defines a conditional route from one node.
   *
   * @param from The source node.
   * @param router The routing function that decides the next step based on the state.
   * @param pathMap A map of routing outputs to destination nodes.
   */
  addConditionalEdges(
    from: string,
    router: RoutingFunction<T>,
    pathMap: Record<string, string>
  ): this {
    if (from === END) {
      throw new Error(`Cannot define conditional edges starting from END node`);
    }
    this.conditionalEdges.set(from, { from, router, pathMap });
    return this;
  }

  /**
   * Sets the initial entry point of the state graph.
   */
  setEntryPoint(name: string): this {
    this.entryPoint = name;
    return this;
  }

  /**
   * Compiles the graph and validates its structure.
   */
  compile(options: StateGraphOptions<T> = {}): CompiledStateGraph<T> {
    if (!this.entryPoint) {
      throw new Error('StateGraph has no entry point set. Call setEntryPoint() before compiling.');
    }
    if (!this.nodes.has(this.entryPoint)) {
      throw new Error(`Entry point "${this.entryPoint}" is not defined as a node in the graph.`);
    }

    // Validate that all edge destinations exist
    for (const [from, to] of this.edges.entries()) {
      if (!this.nodes.has(from)) {
        throw new Error(`Edge starts from undefined node: "${from}"`);
      }
      if (to !== END && !this.nodes.has(to)) {
        throw new Error(`Edge points to undefined node: "${to}"`);
      }
    }

    // Validate conditional edges
    for (const [from, edge] of this.conditionalEdges.entries()) {
      if (!this.nodes.has(from)) {
        throw new Error(`Conditional edge starts from undefined node: "${from}"`);
      }
      for (const dest of Object.values(edge.pathMap)) {
        if (dest !== END && !this.nodes.has(dest)) {
          throw new Error(`Conditional edge path points to undefined node: "${dest}"`);
        }
      }
    }

    return new CompiledStateGraph<T>(
      this.nodes,
      this.edges,
      this.conditionalEdges,
      this.entryPoint,
      this.reducer,
      options
    );
  }
}

/**
 * Runnable compiled state graph.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class CompiledStateGraph<T extends Record<string, any>> {
  constructor(
    private nodes: Map<string, NodeFunction<T>>,
    private edges: Map<string, string>,
    private conditionalEdges: Map<string, ConditionalEdge<T>>,
    private entryPoint: string,
    private reducer: (state: T, update: Partial<T>) => T,
    private options: StateGraphOptions<T>
  ) {}

  /**
   * Invokes/runs the compiled graph from the beginning or from a saved checkpoint.
   *
   * @param initialState The initial state to supply if not resuming from checkpoint.
   * @param threadId Unique execution thread ID.
   * @returns The final state once execution finishes, or the current state if paused/interrupted.
   */
  async invoke(
    initialState: T,
    threadId: string
  ): Promise<{ state: T; status: 'completed' | 'interrupted'; nextNode?: string }> {
    let state = initialState;
    let step = 0;
    let currentNode: string | null = this.entryPoint;
    let bypassInterruptForFirstNode = false;

    // Try to load checkpoint
    if (this.options.checkpointer) {
      const saved = await this.options.checkpointer.loadCheckpoint(threadId);
      if (saved) {
        state = this.reducer(state, saved.state);
        step = saved.step;
        currentNode = saved.currentNode;
        bypassInterruptForFirstNode = true;
        logger.info(
          `[StateGraph] Resumed thread "${threadId}" from step ${step} at node "${currentNode}"`
        );
      }
    }

    while (currentNode && currentNode !== END) {
      // Check for human-in-the-loop interrupts BEFORE running the node
      if (
        this.options.interruptNodes?.includes(currentNode) &&
        step > 0 &&
        !bypassInterruptForFirstNode
      ) {
        logger.info(
          `[StateGraph] Interrupted execution before node "${currentNode}" for thread "${threadId}"`
        );
        return { state, status: 'interrupted', nextNode: currentNode };
      }

      // Reset bypass flag after the check
      bypassInterruptForFirstNode = false;

      const nodeFn = this.nodes.get(currentNode);
      if (!nodeFn) {
        throw new Error(`Execution error: node "${currentNode}" is not defined.`);
      }

      logger.info(
        `[StateGraph] Executing node "${currentNode}" for thread "${threadId}" (Step ${step})`
      );
      const update = await nodeFn(state);

      // Apply reducer
      state = this.reducer(state, update);
      step++;

      // Determine next node
      const nextNode = await this.getNextNode(currentNode, state);

      // Save checkpoint (with nextNode as the node to execute on resume)
      if (this.options.checkpointer) {
        await this.options.checkpointer.saveCheckpoint({
          threadId,
          state,
          step,
          timestamp: Date.now(),
          currentNode: nextNode,
        });
      }

      currentNode = nextNode;
    }

    return { state, status: 'completed' };
  }

  /**
   * Resolves the next node to transition to.
   */
  private async getNextNode(current: string, state: T): Promise<string> {
    // 1. Check direct edges
    if (this.edges.has(current)) {
      return this.edges.get(current)!;
    }

    // 2. Check conditional edges
    if (this.conditionalEdges.has(current)) {
      const cond = this.conditionalEdges.get(current)!;
      const routeResult = await cond.router(state);
      const next = cond.pathMap[routeResult];
      if (!next) {
        throw new Error(
          `Conditional edge router for node "${current}" returned route "${routeResult}", which is not mapped.`
        );
      }
      return next;
    }

    // No edge defined means END of graph
    return END;
  }
}
