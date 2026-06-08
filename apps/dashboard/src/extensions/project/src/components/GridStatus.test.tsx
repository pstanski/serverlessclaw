import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GridStatus from './GridStatus';
import React from 'react';

describe('GridStatus', () => {
  it('should render default values when no data is provided', () => {
    render(<GridStatus component={{ data: {} }} />);
    expect(screen.getByText('Live Power Grid Status')).toBeDefined();
    expect(screen.getByText('12.4 MW')).toBeDefined();
    expect(screen.getByText('50.02 Hz')).toBeDefined();
    expect(screen.getByText('NODE: GLOBAL')).toBeDefined();
  });

  it('should render provided data', () => {
    const data = {
      nodeId: 'AU-01',
      load: '45.2',
      frequency: '49.98',
    };
    render(<GridStatus component={{ data }} />);
    expect(screen.getByText('45.2 MW')).toBeDefined();
    expect(screen.getByText('49.98 Hz')).toBeDefined();
    expect(screen.getByText('NODE: AU-01')).toBeDefined();
  });
});
