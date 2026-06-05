import { describe, it, expect } from 'vitest';
import { MCP_SERVER_REGISTRY } from './registry';

describe('MCP Server Registry', () => {
  it('should have all required external MCP servers registered', () => {
    expect(MCP_SERVER_REGISTRY).toHaveProperty('git');
    expect(MCP_SERVER_REGISTRY).toHaveProperty('filesystem');
    expect(MCP_SERVER_REGISTRY).toHaveProperty('google-search');
    expect(MCP_SERVER_REGISTRY).toHaveProperty('puppeteer');
    expect(MCP_SERVER_REGISTRY).toHaveProperty('fetch');
    expect(MCP_SERVER_REGISTRY).toHaveProperty('aws');
    expect(MCP_SERVER_REGISTRY).toHaveProperty('aws-s3');
    expect(MCP_SERVER_REGISTRY).toHaveProperty('ast');
  });

  describe('Security Boundaries', () => {
    it('filesystem MCP must be restricted to /tmp directory only', () => {
      const fsServer = MCP_SERVER_REGISTRY.filesystem;
      expect(fsServer).toBeDefined();

      // Ensure the arguments enforce the directory boundary
      const args = fsServer.args ?? [];
      expect(args).toContain('/tmp');

      // Ensure it does not allow access to root or sensitive directories
      expect(args).not.toContain('/');
      expect(args).not.toContain('/etc');
      expect(args).not.toContain('.env');

      // The last argument for @modelcontextprotocol/server-filesystem is the allowed directory list
      const lastArg = args[args.length - 1];
      expect(lastArg).toBe('/tmp');
    });

    it('packaged filesystem and ast servers should prefer local entrypoints when available', () => {
      const fsServer = MCP_SERVER_REGISTRY.filesystem;
      const astServer = MCP_SERVER_REGISTRY.ast;

      if (fsServer.command !== 'npx') {
        expect(fsServer.command).toBe(process.execPath);
        expect(fsServer.args?.[0]).toContain('@modelcontextprotocol/server-filesystem');
        expect(fsServer.args).not.toContain('--offline');
      } else {
        expect(fsServer.args).toContain('--offline');
      }

      if (astServer.command !== 'npx') {
        expect(astServer.command).toBe(process.execPath);
        expect(astServer.args?.[0]).toContain('@aiready/ast-mcp-server');
        expect(astServer.args).not.toContain('--offline');
      } else {
        expect(astServer.args).toContain('--offline');
      }
    });

    it('other remote servers should continue to use offline npx launches', () => {
      Object.entries(MCP_SERVER_REGISTRY)
        .filter(([name]) => !['filesystem', 'ast'].includes(name))
        .forEach(([_name, config]) => {
          expect(config.command).toBe('npx');
          expect(config.args).toContain('--offline');
        });
    });

    it('HOME directory should be overridden to /tmp for safety', () => {
      Object.entries(MCP_SERVER_REGISTRY).forEach(([_name, config]) => {
        expect(config.env?.HOME).toBe('/tmp');
      });
    });
  });
});
