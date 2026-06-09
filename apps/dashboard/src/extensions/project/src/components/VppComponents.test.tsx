/* eslint-disable */
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// Setup global fetch mock before importing any components
const mockFetch = vi.fn((url: string) => {
  if (url.includes('/api/x/voltx/dr/trigger')) {
    return Promise.resolve({
      json: () =>
        Promise.resolve({
          success: true,
          executionId: 'dr-test-exec',
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
  const dashboardEn = await import('@messages/en.json');
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

describe('VppComponents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DRSimulator', () => {
    it('should render the simulator with active state', () => {
      render(<DRSimulator />);
      expect(screen.getByText('Demand Response Hub')).toBeDefined();
    });

    it('should trigger DR event when button is clicked', async () => {
      render(<DRSimulator />);
      const button = screen.getByText('Execute Dispatch');
      await act(async () => {
        fireEvent.click(button);
      });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/x/voltx/dr/trigger'), expect.any(Object));
    });
  });

  describe('EnergyFlowVisualizer', () => {
    it('should render the energy flow visualizer', () => {
      render(<EnergyFlowVisualizer />);
      expect(screen.getByText('Real-time Energy Flow')).toBeDefined();
    });
  });

  describe('FinancialSettlement', () => {
    it('should render the financial settlement ledger', () => {
      render(<FinancialSettlement />);
      expect(screen.getByText('VPP Settlement Ledger')).toBeDefined();
    });
  });
});
