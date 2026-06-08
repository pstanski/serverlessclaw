import GridStatus from './components/GridStatus';
import MissionControl from './components/dashboard/MissionControl';
import { AssetManagement } from './components/dashboard/AssetManagement';
import { Activity, Shield, Home } from 'lucide-react';
import { EnergyFlowVisualizer } from './components/EnergyFlowVisualizer';
import { AssetOnboarding } from './components/AssetOnboarding';

/**
 * Voltx UI Extension Exports
 *
 * Includes both landing page and dashboard extension components.
 * The framework dashboard build process copies these exports into
 * the extensions/hub directory at build time.
 */
export { EnergyFlowVisualizer, AssetOnboarding, AssetManagement };
export { DRSimulator } from './components/dashboard/DRSimulator';
export { FinancialSettlement } from './components/FinancialSettlement';

/**
 * VoltX Server Extension Initializer
 */
export function initServer() {
  // Server-side initialization if needed
}

/**
 * VoltX Dashboard Extension Initializer
 */
export function init({
  registerSidebar,
  registerComponent,
}: {
  registerSidebar: (config: {
    id: string;
    label: string;
    subtitle: string;
    href?: string;
    icon: React.ComponentType<{ className?: string }>;
    section: string;
    requiredRoles?: string[];
  }) => void;
  registerComponent: (config: {
    type: string;
    component: React.ComponentType<Record<string, unknown>>;
  }) => void;
}) {
  // 1. Register Mission Control (Primary Operational View)
  registerSidebar({
    id: 'voltx-mission-control',
    label: 'Mission Control',
    subtitle: 'Strategic Command & Control',
    href: '/extension/voltx-mission-control',
    icon: Shield,
    section: 'OPERATIONS',
    requiredRoles: ['admin', 'owner', 'member', 'viewer'],
  });

  // 2. Register Site Management Sidebar
  registerSidebar({
    id: 'voltx-sites',
    label: 'Site Management',
    subtitle: 'VPP Fleet Config',
    href: '/extension/voltx-asset-management',
    icon: Home,
    section: 'OPERATIONS',
    requiredRoles: ['admin', 'owner', 'member'],
  });

  // 3. Register Energy Sidebar Item (Detailed Grid View)
  registerSidebar({
    id: 'voltx-grid',
    label: 'Energy Grid',
    subtitle: 'Real-time performance',
    href: '/extension/voltx-grid-status',
    icon: Activity,
    section: 'OPERATIONS',
  });

  // 4. Register Dashboard Components
  registerComponent({
    type: 'voltx-mission-control',
    component: MissionControl,
  });

  registerComponent({
    type: 'voltx-grid-status',
    component: GridStatus,
  });

  registerComponent({
    type: 'voltx-asset-management',
    component: AssetManagement,
  });
}
