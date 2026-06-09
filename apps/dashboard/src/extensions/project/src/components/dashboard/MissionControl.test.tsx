/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

// Setup global fetch mock before importing any components
const mockFetch = vi.fn((url: string) => {
  if (url.includes('/api/x/voltx/stats')) {
    return Promise.resolve({
      json: () =>
        Promise.resolve({
          totalCapacityMw: 450,
          currentOutputMw: 285,
          flexibilityUpMw: 120,
          flexibilityDownMw: 85,
          activeNodes: 124,
          timestamp: new Date().toISOString(),
        }),
    });
  }
  return Promise.resolve({
    json: () => Promise.resolve({}),
  });
});
vi.stubGlobal('fetch', mockFetch);

import MissionControl from './MissionControl';

vi.mock('@claw/ui', async (importOriginal) => {
  const original = await importOriginal<any>();
  const voltxEn = await import('../../../messages/en.json');
  const dashboardEn = await import('../../../../../../messages/en.json');
  const allTranslations: Record<string, string> = {
    ...dashboardEn.default,
    ...voltxEn.default,
  };
  return {
    ...original,
    useTranslations: () => ({
      t: (key: string) => allTranslations[key] || key,
      locale: 'en',
      setLocale: async () => {},
      formatDate: (d: any) => new Date(d).toLocaleDateString('en-US'),
      formatTime: (d: any) => new Date(d).toLocaleTimeString('en-US'),
    }),
  };
});

describe('MissionControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the mission control center with stats', async () => {
    await act(async () => {
      render(<MissionControl />);
    });
    
    expect(screen.getByText('Virtual Power Plant Control Center')).toBeDefined();
    expect(screen.getByText('450')).toBeDefined(); // Total Capacity
    expect(screen.getByText('285')).toBeDefined(); // Current Output
  });

  it('should render all three core visualization tabs', async () => {
    await act(async () => {
      render(<MissionControl />);
    });
    
    expect(screen.getByText('Network Topology')).toBeDefined();
    expect(screen.getByText('Demand Response')).toBeDefined();
    expect(screen.getByText('Revenue Ledger')).toBeDefined();
  });
});
