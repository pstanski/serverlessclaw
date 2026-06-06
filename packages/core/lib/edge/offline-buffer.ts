import { logger } from '../logger';

export interface BufferedEvent {
  id: string;
  topic: string;
  payload: any;
  timestamp: number;
}

export interface IOfflineStorage {
  save(event: BufferedEvent): Promise<void>;
  getAll(): Promise<BufferedEvent[]>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Simple in-memory storage fallback for offline events
 */
export class MemoryOfflineStorage implements IOfflineStorage {
  private events: Map<string, BufferedEvent> = new Map();

  async save(event: BufferedEvent): Promise<void> {
    this.events.set(event.id, event);
  }

  async getAll(): Promise<BufferedEvent[]> {
    return Array.from(this.events.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  async remove(id: string): Promise<void> {
    this.events.delete(id);
  }

  async clear(): Promise<void> {
    this.events.clear();
  }
}

/**
 * OfflineEventBuffer
 * Manages buffering and replaying events when connectivity is lost and restored.
 */
export class OfflineEventBuffer {
  private online: boolean = true;
  private syncInProgress: boolean = false;

  constructor(
    private storage: IOfflineStorage = new MemoryOfflineStorage(),
    private publishFn: (topic: string, payload: any) => Promise<void>
  ) {}

  /**
   * Sets the current connectivity state.
   * If transitioning to online, triggers a flush/replay of the buffer.
   */
  async setConnectivity(online: boolean): Promise<void> {
    const wasOffline = !this.online;
    this.online = online;

    logger.info(`[OfflineBuffer] Connectivity changed: online = ${online}`);

    if (online && wasOffline) {
      await this.flush();
    }
  }

  /**
   * Submits an event to the buffer.
   * If online, publishes directly.
   * If offline, stores it for later playback.
   */
  async submit(
    topic: string,
    payload: any
  ): Promise<{ status: 'published' | 'buffered'; id: string }> {
    const id = `evt-${Math.random().toString(36).substring(2, 11)}`;
    const event: BufferedEvent = {
      id,
      topic,
      payload,
      timestamp: Date.now(),
    };

    if (this.online) {
      try {
        await this.publishFn(topic, payload);
        return { status: 'published', id };
      } catch (err) {
        logger.warn(`[OfflineBuffer] Publish failed, buffering event: ${err}`);
      }
    }

    // Buffer the event if offline or publish failed
    await this.storage.save(event);
    logger.info(`[OfflineBuffer] Buffered event "${id}" on topic "${topic}"`);
    return { status: 'buffered', id };
  }

  /**
   * Flushes/replays all buffered events in FIFO order.
   */
  async flush(): Promise<void> {
    if (this.syncInProgress) {
      logger.info(`[OfflineBuffer] Sync already in progress, skipping flush`);
      return;
    }

    this.syncInProgress = true;
    logger.info(`[OfflineBuffer] Starting event replay...`);

    try {
      let events = await this.storage.getAll();
      while (events.length > 0 && this.online) {
        const event = events[0];
        try {
          logger.info(`[OfflineBuffer] Replaying event "${event.id}" to topic "${event.topic}"`);
          await this.publishFn(event.topic, event.payload);
          await this.storage.remove(event.id);
        } catch (err) {
          logger.error(
            `[OfflineBuffer] Replay failed for event "${event.id}": ${err}. Halting sync.`
          );
          break; // Stop replaying if we encounter an error or connectivity drops again
        }
        events = await this.storage.getAll();
      }
      logger.info(`[OfflineBuffer] Sync complete. Remaining events in buffer: ${events.length}`);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Retrieves the current buffer size.
   */
  async getBufferSize(): Promise<number> {
    const events = await this.storage.getAll();
    return events.length;
  }
}
