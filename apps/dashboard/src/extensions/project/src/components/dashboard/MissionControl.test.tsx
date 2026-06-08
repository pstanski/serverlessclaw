import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

// Setup global fetch mock before importing any components
const mockFetch = vi.fn((url: string) => {
  if (url.includes('/api/x/voltx/dr/trigger')) {
    return Promise.resolve({
      json: () =>
        Promise.resolve({
          finalState: {
            executionLog: ['SIGNAL DETECTED', 'EXECUTING BATT_DISCHARGE', 'EVENT COMPLETED'],
          },
        }),
    });
  }
  if (url.includes('/api/x/voltx/telemetry')) {
    return Promise.resolve({
      json: () =>
        Promise.resolve({
          sites: [
            {
              id: 'site-1',
              assets: [
                { type: 'SOLAR', capacityKw: 60000, telemetry: {} },
                {
                  type: 'BATTERY',
                  capacityKw: 40000,
                  telemetry: { soc: 65.4, currentPowerKw: 5.2 },
                },
                { type: 'LOAD', capacityKw: 20000, telemetry: {} },
              ],
            },
          ],
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
  const dashboardEn = await import('../../../../../framework/apps/dashboard/messages/en.json');
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

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Activity: () => <div data-testid="icon-activity" />,
  Zap: () => <div data-testid="icon-zap" />,
  TrendingUp: () => <div data-testid="icon-trending-up" />,
  AlertTriangle: () => <div data-testid="icon-alert" />,
  Users: () => <div data-testid="icon-users" />,
  DollarSign: () => <div data-testid="icon-dollar" />,
  ShieldCheck: () => <div data-testid="icon-shield" />,
  Leaf: () => <div data-testid="icon-leaf" />,
  Battery: () => <div data-testid="icon-battery" />,
  ShieldAlert: () => <div data-testid="icon-shield-alert" />,
  Play: () => <div data-testid="icon-play" />,
  Timer: () => <div data-testid="icon-timer" />,
  Receipt: () => <div data-testid="icon-receipt" />,
  ArrowRightLeft: () => <div data-testid="icon-arrow-right-left" />,
  CheckCircle2: () => <div data-testid="icon-check-circle" />,
  ArrowUpRight: () => <div data-testid="icon-arrow-up-right" />,
  Home: () => <div data-testid="icon-home" />,
}));

describe('MissionControl', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.fetch = mockFetch as any;
    if (typeof window !== 'undefined') {
      window.fetch = mockFetch as any;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the VPP title and system status', () => {
    render(<MissionControl />);
    expect(screen.getByText(/Enerlink/i)).toBeDefined();
    expect(screen.getByText(/Nexus/i)).toBeDefined();
    expect(screen.getByText(/VPP Dispatch:/i)).toBeDefined();
    // Check for the "Active" status badge specifically
    const activeBadges = screen.getAllByText(/Active/i);
    expect(activeBadges.length).toBeGreaterThan(0);
  });

  it('renders high-value global metrics from pitch deck', () => {
    render(<MissionControl />);
    expect(screen.getByText('47 Sites')).toBeDefined();
    // Savings appears in multiple places, use getAllByText
    const savingsMetrics = screen.getAllByText(/\+¥2.1M/i);
    expect(savingsMetrics.length).toBeGreaterThan(0);
    expect(screen.getByText('-12.4%')).toBeDefined();
    expect(screen.getByText('99.97%')).toBeDefined();
  });

  it('renders the VPP Asset Portfolio with MW values', () => {
    render(<MissionControl />);
    expect(screen.getByText('Total Capacity')).toBeDefined();
    expect(screen.getByText('120')).toBeDefined();
    expect(screen.getByText('Solar PV')).toBeDefined();
    expect(screen.getByText('60')).toBeDefined();
  });

  it('renders simulation metrics and updates over time', async () => {
    render(<MissionControl />);

    // Check if initial price exists
    const priceElements = screen.getAllByText(/¥/i);
    expect(priceElements.length).toBeGreaterThan(0);

    // Fast-forward 3 seconds for the simulation loop
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // Check if currency and percentage symbols are still there after update
    expect(screen.getAllByText(/¥/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/%/i).length).toBeGreaterThan(0);
  });

  it('renders the DR Simulator and Financial Ledger', () => {
    render(<MissionControl />);
    expect(screen.getByText(/Dispatch Simulator/i)).toBeDefined();
    expect(screen.getByText(/Trigger Grid Event/i)).toBeDefined();
    expect(screen.getByText(/VPP Settlement Ledger/i)).toBeDefined();
  });
  it('renders the Environmental Impact card', () => {
    render(<MissionControl />);
    expect(screen.getByText('Environmental Impact')).toBeDefined();
    expect(screen.getByText('12.3 Tons CO₂')).toBeDefined();
  });
});
