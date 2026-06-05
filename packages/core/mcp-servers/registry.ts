import { type StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function resolvePackageBin(packageName: string, preferredBin?: string): string | undefined {
  try {
    const packageJsonPath = require.resolve(`${packageName}/package.json`);
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      bin?: string | Record<string, string>;
    };

    const relativeBin =
      typeof packageJson.bin === 'string'
        ? packageJson.bin
        : ((preferredBin ? packageJson.bin?.[preferredBin] : undefined) ??
          Object.values(packageJson.bin ?? {})[0]);

    return relativeBin ? resolve(dirname(packageJsonPath), relativeBin) : undefined;
  } catch {
    return undefined;
  }
}

const NODE_COMMAND = process.execPath || 'node';
const LOCAL_FILESYSTEM_BIN = resolvePackageBin(
  '@modelcontextprotocol/server-filesystem',
  'mcp-server-filesystem'
);
const LOCAL_AST_BIN = resolvePackageBin('@aiready/ast-mcp-server', 'ast-mcp-server');

/**
 * Central registry of all MCP server configurations.
 * These parameters are used by the Unified MCP Multiplexer to spawn
 * the appropriate child processes on-demand.
 */
export const MCP_SERVER_REGISTRY: Record<string, StdioServerParameters> = {
  git: {
    command: 'npx',
    args: ['--offline', '@cyanheads/git-mcp-server'],
    env: {
      HOME: '/tmp',
    },
  },
  filesystem: {
    command: LOCAL_FILESYSTEM_BIN ? NODE_COMMAND : 'npx',
    args: LOCAL_FILESYSTEM_BIN
      ? [LOCAL_FILESYSTEM_BIN, '/tmp']
      : ['--offline', '@modelcontextprotocol/server-filesystem', '/tmp'],
    env: {
      HOME: '/tmp',
    },
  },
  'google-search': {
    command: 'npx',
    args: ['--offline', '@mcp-server/google-search-mcp'],
    env: {
      HOME: '/tmp',
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ?? '',
      GOOGLE_SEARCH_ENGINE_ID: process.env.GOOGLE_SEARCH_ENGINE_ID ?? '',
    },
  },
  puppeteer: {
    command: 'npx',
    args: ['--offline', '@kirkdeam/puppeteer-mcp-server'],
    env: {
      HOME: '/tmp',
      PUPPETEER_EXECUTABLE_PATH: '/opt/chromium',
    },
  },
  playwright: {
    command: 'npx',
    args: ['--offline', '@mcp-server/playwright'],
    env: {
      HOME: '/tmp',
      PLAYWRIGHT_BROWSERS_PATH: '/opt/pw-browsers',
    },
  },
  fetch: {
    command: 'npx',
    args: ['--offline', 'mcp-fetch-server'],
    env: {
      HOME: '/tmp',
    },
  },
  aws: {
    command: 'npx',
    args: ['--offline', 'mcp-aws-devops-server'],
    env: {
      HOME: '/tmp',
    },
  },
  'aws-s3': {
    command: 'npx',
    args: ['--offline', '@geunoh/s3-mcp-server'],
    env: {
      HOME: '/tmp',
    },
  },
  ast: {
    command: LOCAL_AST_BIN ? NODE_COMMAND : 'npx',
    args: LOCAL_AST_BIN ? [LOCAL_AST_BIN] : ['--offline', '@aiready/ast-mcp-server@0.8.6'],
    env: {
      HOME: '/tmp',
      NPM_CONFIG_CACHE: '/tmp/npm-cache',
      XDG_CACHE_HOME: '/tmp/mcp-cache',
    },
  },
};

export type MCPServerName = keyof typeof MCP_SERVER_REGISTRY;
