import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveSSTResourceValue, getAppInfo } from './resource-helpers';

describe('resource-helpers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // @ts-expect-error - clean global state
    delete globalThis.Resource;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('resolveSSTResourceValue', () => {
    it('should prioritize explicit override env var', () => {
      process.env.MY_OVERRIDE = 'explicit-value';
      const result = resolveSSTResourceValue('MyResource', 'name', 'MY_OVERRIDE');
      expect(result).toBe('explicit-value');
    });

    it('should use SST Ion JSON fallback (SST_RESOURCE_<Name>)', () => {
      process.env.SST_RESOURCE_MyResource = JSON.stringify({
        name: 'ion-name',
        value: 'ion-value',
      });
      const result = resolveSSTResourceValue('MyResource', 'name');
      expect(result).toBe('ion-name');
    });

    it('should handle non-JSON SST Ion fallback for name/value properties', () => {
      process.env.SST_RESOURCE_MyResource = 'direct-ion-value';
      expect(resolveSSTResourceValue('MyResource', 'name')).toBe('direct-ion-value');
      expect(resolveSSTResourceValue('MyResource', 'value')).toBe('direct-ion-value');
    });

    it('should use globalThis.Resource (test mocking support)', () => {
      (globalThis as any).Resource = {
        MyResource: { name: 'global-name' },
      };
      const result = resolveSSTResourceValue('MyResource', 'name');
      expect(result).toBe('global-name');
    });

    it('should handle dynamic globalThis.Resource from defineProperty', () => {
      // Mocking what the global setup does but with our own mock
      const mockResource = {
        MyResource: { name: 'dynamic-name' },
      };
      Object.defineProperty(globalThis, 'Resource', {
        get: () => mockResource,
        configurable: true,
      });
      const result = resolveSSTResourceValue('MyResource', 'name');
      expect(result).toBe('dynamic-name');
    });

    it('should perform fuzzy env match as a robust fallback', () => {
      process.env.MY_RESOURCE_NAME = 'fuzzy-value';
      const result = resolveSSTResourceValue('MyResource', 'name');
      expect(result).toBe('fuzzy-value');
    });

    it('should return default value if nothing else is found', () => {
      const result = resolveSSTResourceValue('Unknown', 'name', undefined, 'default-val');
      expect(result).toBe('default-val');
    });
  });

  describe('getAppInfo', () => {
    it('should extract info from SST_RESOURCE_App', () => {
      process.env.SST_RESOURCE_App = JSON.stringify({ name: 'ion-app', stage: 'ion-stage' });
      const result = getAppInfo();
      expect(result).toEqual({ name: 'ion-app', stage: 'ion-stage' });
    });

    it('should fall back to legacy SST_APP and SST_STAGE env vars', () => {
      delete process.env.SST_RESOURCE_App;
      process.env.SST_APP = 'legacy-app';
      process.env.SST_STAGE = 'legacy-stage';
      const result = getAppInfo();
      expect(result).toEqual({ name: 'legacy-app', stage: 'legacy-stage' });
    });
  });
});
