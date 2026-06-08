import { Checkpointer, Checkpoint } from './state-graph';

/**
 * In-memory implementation of Checkpointer for testing and lightweight local runtimes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class MemoryCheckpointer<T extends Record<string, any>> implements Checkpointer<T> {
  private storage: Map<string, Checkpoint<T>> = new Map();

  async saveCheckpoint(checkpoint: Checkpoint<T>): Promise<void> {
    // Perform deep copy to prevent mutation of the checkpoint state
    const copiedState = JSON.parse(JSON.stringify(checkpoint.state));
    this.storage.set(checkpoint.threadId, {
      ...checkpoint,
      state: copiedState,
    });
  }

  async loadCheckpoint(threadId: string): Promise<Checkpoint<T> | null> {
    const checkpoint = this.storage.get(threadId);
    if (!checkpoint) return null;

    // Return deep copy
    return {
      ...checkpoint,
      state: JSON.parse(JSON.stringify(checkpoint.state)),
    };
  }

  /**
   * Resets and clears all checkpoints.
   */
  clear(): void {
    this.storage.clear();
  }
}
