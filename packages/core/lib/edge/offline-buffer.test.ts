import { describe, it, expect, vi } from 'vitest';
import { OfflineEventBuffer, MemoryOfflineStorage } from './offline-buffer';

describe('OfflineEventBuffer', () => {
  it('should publish directly when online', async () => {
    const publishMock = vi.fn().mockResolvedValue(undefined);
    const buffer = new OfflineEventBuffer(new MemoryOfflineStorage(), publishMock);

    const res = await buffer.submit('device/telemetry', { val: 100 });

    expect(res.status).toBe('published');
    expect(publishMock).toHaveBeenCalledWith('device/telemetry', { val: 100 });
    expect(await buffer.getBufferSize()).toBe(0);
  });

  it('should buffer events when offline', async () => {
    const publishMock = vi.fn().mockResolvedValue(undefined);
    const buffer = new OfflineEventBuffer(new MemoryOfflineStorage(), publishMock);

    await buffer.setConnectivity(false);
    const res = await buffer.submit('device/telemetry', { val: 100 });

    expect(res.status).toBe('buffered');
    expect(publishMock).not.toHaveBeenCalled();
    expect(await buffer.getBufferSize()).toBe(1);
  });

  it('should replay buffered events in FIFO order when connectivity is restored', async () => {
    const publishMock = vi.fn().mockResolvedValue(undefined);
    const buffer = new OfflineEventBuffer(new MemoryOfflineStorage(), publishMock);

    await buffer.setConnectivity(false);
    await buffer.submit('device/event1', { id: 1 });
    await buffer.submit('device/event2', { id: 2 });

    expect(await buffer.getBufferSize()).toBe(2);

    // Reconnection should trigger automatic flush
    await buffer.setConnectivity(true);

    expect(publishMock).toHaveBeenCalledTimes(2);
    expect(publishMock.mock.calls[0]).toEqual(['device/event1', { id: 1 }]);
    expect(publishMock.mock.calls[1]).toEqual(['device/event2', { id: 2 }]);
    expect(await buffer.getBufferSize()).toBe(0);
  });
});
