import { describe, it, expect } from 'vitest';
import { StateGraph, END } from './state-graph';
import { MemoryCheckpointer } from './checkpoint';

describe('StateGraph', () => {
  interface SimpleState {
    count: number;
    log: string[];
  }

  it('should run a basic linear graph', async () => {
    const graph = new StateGraph<SimpleState>({ count: 0, log: [] })
      .addNode('nodeA', (state) => ({
        count: state.count + 1,
        log: [...state.log, 'A'],
      }))
      .addNode('nodeB', (state) => ({
        count: state.count + 1,
        log: [...state.log, 'B'],
      }))
      .setEntryPoint('nodeA')
      .addEdge('nodeA', 'nodeB')
      .addEdge('nodeB', END);

    const compiled = graph.compile();
    const result = await compiled.invoke({ count: 0, log: [] }, 'thread-1');

    expect(result.status).toBe('completed');
    expect(result.state.count).toBe(2);
    expect(result.state.log).toEqual(['A', 'B']);
  });

  it('should handle conditional edges and routing', async () => {
    const graph = new StateGraph<SimpleState>({ count: 0, log: [] })
      .addNode('nodeA', (state) => ({
        log: [...state.log, 'A'],
      }))
      .addNode('nodeB', (state) => ({
        log: [...state.log, 'B'],
      }))
      .addNode('nodeC', (state) => ({
        log: [...state.log, 'C'],
      }))
      .setEntryPoint('nodeA')
      .addConditionalEdges('nodeA', (state) => (state.count > 5 ? 'routeC' : 'routeB'), {
        routeB: 'nodeB',
        routeC: 'nodeC',
      })
      .addEdge('nodeB', END)
      .addEdge('nodeC', END);

    const compiled = graph.compile();

    // Route B test
    const resB = await compiled.invoke({ count: 0, log: [] }, 'thread-b');
    expect(resB.state.log).toEqual(['A', 'B']);

    // Route C test
    const resC = await compiled.invoke({ count: 10, log: [] }, 'thread-c');
    expect(resC.state.log).toEqual(['A', 'C']);
  });

  it('should support cycles and loops', async () => {
    const graph = new StateGraph<SimpleState>({ count: 0, log: [] })
      .addNode('increment', (state) => ({
        count: state.count + 1,
        log: [...state.log, `step-${state.count + 1}`],
      }))
      .setEntryPoint('increment')
      .addConditionalEdges('increment', (state) => (state.count < 3 ? 'loop' : 'exit'), {
        loop: 'increment',
        exit: END,
      });

    const compiled = graph.compile();
    const result = await compiled.invoke({ count: 0, log: [] }, 'thread-loop');

    expect(result.status).toBe('completed');
    expect(result.state.count).toBe(3);
    expect(result.state.log).toEqual(['step-1', 'step-2', 'step-3']);
  });

  it('should pause and resume from checkpoints', async () => {
    const checkpointer = new MemoryCheckpointer<SimpleState>();
    const graph = new StateGraph<SimpleState>({ count: 0, log: [] })
      .addNode('node1', (state) => ({
        count: state.count + 1,
        log: [...state.log, '1'],
      }))
      .addNode('node2', (state) => ({
        count: state.count + 1,
        log: [...state.log, '2'],
      }))
      .setEntryPoint('node1')
      .addEdge('node1', 'node2')
      .addEdge('node2', END);

    // Run with interrupt before node2
    const compiled = graph.compile({
      checkpointer,
      interruptNodes: ['node2'],
    });

    const threadId = 'thread-pause-resume';
    const result1 = await compiled.invoke({ count: 0, log: [] }, threadId);

    expect(result1.status).toBe('interrupted');
    expect(result1.nextNode).toBe('node2');
    expect(result1.state.count).toBe(1);
    expect(result1.state.log).toEqual(['1']);

    // Resume execution
    const result2 = await compiled.invoke(result1.state, threadId);

    expect(result2.status).toBe('completed');
    expect(result2.state.count).toBe(2);
    expect(result2.state.log).toEqual(['1', '2']);
  });
});
