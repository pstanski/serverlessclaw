import { render, screen, act, fireEvent } from '@testing-library/react';
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
  return Promise.resolve({
    json: () => Promise.resolve({}),
  });
});
vi.stubGlobal('fetch', mockFetch);

import { DRSimulator } from './dashboard/DRSimulator';
import { EnergyFlowVisualizer } from './EnergyFlowVisualizer';
import { FinancialSettlement } from './FinancialSettlement';

vi.mock('@claw/ui', async (importOriginal) => {
  const original = await importOriginal<any>();
  const voltxEn = await import('../../messages/en.json');
  const dashboardEn = await import('../../../../framework/apps/dashboard/messages/en.json');
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
  Zap: () => <div data-testid="icon-zap" />,
  Battery: () => <div data-testid="icon-battery" />,
  Home: () => <div data-testid="icon-home" />,
  ArrowRightLeft: () => <div data-testid="icon-arrow-right-left" />,
  TrendingUp: () => <div data-testid="icon-trending-up" />,
  CheckCircle2: () => <div data-testid="icon-check-circle" />,
  ArrowUpRight: () => <div data-testid="icon-arrow-up-right" />,
  Receipt: () => <div data-testid="icon-receipt" />,
  ShieldAlert: () => <div data-testid="icon-shield-alert" />,
  Play: () => <div data-testid="icon-play" />,
  Timer: () => <div data-testid="icon-timer" />,
}));

describe('VPP UI Components', () => {
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

  describe('DRSimulator', () => {
    it('renders in idle state initially', () => {
      render(<DRSimulator isAdmin={true} />);
      expect(screen.getByText(/Dispatch Simulator/i)).toBeDefined();
      expect(screen.getByText(/Trigger Grid Event/i)).toBeDefined();
      expect(screen.getByText(/WAITING FOR SIGNAL/i)).toBeDefined();
    });

    it('handles simulation lifecycle', async () => {
      render(<DRSimulator isAdmin={true} />);
      const button = screen.getByText(/Trigger Grid Event/i);

      fireEvent.click(button);

      // Flush microtasks for fetch and res.json() to resolve
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should show Alert state
      expect(screen.getByText(/SIGNAL DETECTED/i)).toBeDefined();

      // Advance to Dispatching
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByText(/EXECUTING BATT_DISCHARGE/i)).toBeDefined();

      // Advance to Success (approx 20 steps * 200ms = 4000ms + buffer)
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByText(/EVENT COMPLETED/i)).toBeDefined();
      expect(screen.getByText(/¥/i)).toBeDefined(); // Revenue should be calculated
    });
  });

  describe('EnergyFlowVisualizer', () => {
    it('renders all flow segments', () => {
      render(<EnergyFlowVisualizer />);
      expect(screen.getByText(/Solar Generation/i)).toBeDefined();
      expect(screen.getByText(/Grid Interaction/i)).toBeDefined();
      expect(screen.getByText(/Battery State/i)).toBeDefined();
      expect(screen.getByText(/Facility Load/i)).toBeDefined();
    });

    it('updates telemetry over time', async () => {
      render(<EnergyFlowVisualizer />);

      // Snapshot of values (since they are numbers, we check if they exist)
      expect(screen.getAllByText(/kW/i).length).toBe(4);

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      // Still has kW labels after update
      expect(screen.getAllByText(/kW/i).length).toBe(4);
    });
  });

  describe('FinancialSettlement', () => {
    it('renders revenue overview', () => {
      render(<FinancialSettlement />);
      expect(screen.getByText(/Total Value Created/i)).toBeDefined();
      expect(screen.getByText(/Pending Settlement/i)).toBeDefined();
      expect(screen.getAllByText(/¥/i).length).toBeGreaterThan(0);
    });

    it('renders transaction history', () => {
      render(<FinancialSettlement />);
      expect(screen.getByText(/Frequency Ancillary Response/i)).toBeDefined();
      expect(screen.getByText(/Peak Valley Arbitrage/i)).toBeDefined();
    });
  });
});
