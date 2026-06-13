import { describe, it, expect, vi } from 'vitest';
import { init } from './index';

describe('VoltX UI Extension', () => {
  it('should register sidebar items and components', () => {
    const registerSidebar = vi.fn();
    const registerComponent = vi.fn();

    init({ registerSidebar, registerComponent });

    // Verify sidebar registrations
    expect(registerSidebar).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'voltx-mission-control',
        label: 'MISSION_CONTROL',
      })
    );
    expect(registerSidebar).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'voltx-grid',
        label: 'ENERGY_GRID',
      })
    );

    // Verify component registrations
    expect(registerComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'voltx-mission-control',
      })
    );
    expect(registerComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'voltx-grid-status',
      })
    );
  });
});
