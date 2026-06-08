import { Server } from 'lucide-react';
import { DevicesPage } from '../components/Devices/DevicesPage';

/**
 * VoltX (Enerlink Nexus) Extensions
 *
 * This file registers domain-specific UI elements into the generic
 * ServerlessClaw dashboard.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function init({ registerSidebar, registerComponent }: any) {
  // 1. Register the Devices Fleet Management page component
  // This allows the framework to render the component when requested
  registerComponent({
    type: 'nexus-devices-view',
    component: DevicesPage,
  });

  // 2. Register the Sidebar link
  registerSidebar({
    id: 'nexus-devices',
    label: 'DEVICES',
    subtitle: 'DEVICES_SUBTITLE',
    href: '/extension/nexus-devices-view',
    icon: Server,
    section: 'OPERATIONS',
    requiredRoles: ['admin', 'owner', 'member'],
  });

  console.log('[VoltX-Extension] Initialized Energy Domain modules.');
}
