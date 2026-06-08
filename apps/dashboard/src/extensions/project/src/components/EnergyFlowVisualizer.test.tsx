import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { EnergyFlowVisualizer } from './EnergyFlowVisualizer';
import React from 'react';

describe('EnergyFlowVisualizer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render the live energy flow title', () => {
    render(<EnergyFlowVisualizer />);
    expect(screen.getByText('Live Dispatch Flow')).toBeDefined();
  });

  it('should update data over time', async () => {
    render(<EnergyFlowVisualizer />);

    // Initial state (45.2kW)
    const solarText =
      screen.getByText('Solar Generation').parentElement?.nextElementSibling?.textContent;
    expect(solarText).toBe('45.2kW');

    // Advance time by 4 seconds (interval is 3000ms)
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    // Check if values updated (they should no longer be 45.2kW)
    const updatedSolarText =
      screen.getByText('Solar Generation').parentElement?.nextElementSibling?.textContent;
    expect(updatedSolarText).not.toBe('45.2kW');
  });

  it('should display grid tie suffix based on flow direction', () => {
    render(<EnergyFlowVisualizer />);
    const gridTieValue = screen.getByText('Grid Interaction').parentElement?.nextElementSibling;
    expect(gridTieValue?.textContent).toMatch(/\(IN\)|\(OUT\)/);
  });
});
