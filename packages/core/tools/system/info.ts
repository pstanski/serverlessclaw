import * as os from 'os';

/**
 * Retrieves environment-specific information for the current execution context.
 */
export const system_get_environment_info = {
  name: 'system_get_environment_info',
  description: 'Returns the current Node.js version, platform, and memory usage for debugging.',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async (): Promise<string> => {
    try {
      const info = {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        hostname: os.hostname(),
        loadAvg: os.loadavg(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        cpus: os.cpus().length,
      };

      return JSON.stringify(info, null, 2);
    } catch (error) {
      return `FAILED: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
