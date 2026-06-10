import { describe, it, expect } from 'vitest';
import { system_get_environment_info } from './info';

describe('system_get_environment_info', () => {
  it('should return environment information', async () => {
    const result = await system_get_environment_info.execute();
    const info = JSON.parse(result);

    expect(info).toHaveProperty('nodeVersion');
    expect(info).toHaveProperty('platform');
    expect(info).toHaveProperty('arch');
    expect(info).toHaveProperty('memoryUsage');
    expect(info.nodeVersion).toBe(process.version);
  });
});
