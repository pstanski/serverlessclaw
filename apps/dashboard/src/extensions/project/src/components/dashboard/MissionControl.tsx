'use client';

import React from 'react';
import { useTranslations } from '@/components/Providers/TranslationsProvider';
import { EnergyFlowVisualizer } from '../EnergyFlowVisualizer';
import { FinancialSettlement } from '../FinancialSettlement';
import { DRSimulator } from './DRSimulator';

import {
  Activity,
  Zap,
  TrendingUp,
  Users,
  DollarSign,
  ShieldCheck,
  Leaf,
  Battery,
} from 'lucide-react';

const getWorkspaceId = () => {
  if (typeof window === 'undefined') return 'default';
  const urlParams = new URLSearchParams(window.location.search);
  return (
    urlParams.get('workspaceId') ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('claw_active_workspace') : null) ||
    'default'
  );
};

/**
 * MissionControl Dashboard
 * High-fidelity Command & Control center for complex operations.
 */
export default function MissionControl({ isAdmin = false }: { isAdmin?: boolean }) {
  const { t } = useTranslations();
  const [soc, setSoc] = React.useState(65.4);
  const [price, setPrice] = React.useState(0.82);
  const [savings, setSavings] = React.useState(18.2);

  const [totalCapacity, setTotalCapacity] = React.useState(120000); // in kW
  const [solarCapacity, setSolarCapacity] = React.useState(60000); // in kW
  const [storageCapacity, setStorageCapacity] = React.useState(40000); // in kW
  const [loadCapacity, setLoadCapacity] = React.useState(20000); // in kW
  const [chargingPower, setChargingPower] = React.useState(5.2);

  const workspaceId = getWorkspaceId();

  React.useEffect(() => {
    const interval = setInterval(() => {
      setPrice((prev) => {
        const delta = (Math.random() - 0.5) * 0.005;
        return Number((prev + delta).toFixed(2));
      });
      setSavings((prev) => {
        const delta = (Math.random() - 0.3) * 0.02;
        return Number((prev + delta).toFixed(1));
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    const fetchTelemetry = async () => {
      if (typeof fetch === 'undefined') return;
      try {
        const res = await fetch(`/api/x/voltx/telemetry?workspaceId=${workspaceId}`);
        const data = await res.json();
        if (data.sites) {
          let totalKw = 0;
          let solarKw = 0;
          let storageKw = 0;
          let loadKw = 0;
          let batterySocSum = 0;
          let batteryCount = 0;
          let currentBatteryPower = 0;

          for (const site of data.sites) {
            for (const asset of site.assets) {
              totalKw += asset.capacityKw;
              if (asset.type === 'SOLAR') {
                solarKw += asset.capacityKw;
              } else if (asset.type === 'BATTERY') {
                storageKw += asset.capacityKw;
                if (asset.telemetry.soc !== undefined) {
                  batterySocSum += asset.telemetry.soc;
                  batteryCount++;
                }
                currentBatteryPower += asset.telemetry.currentPowerKw || 0;
              } else {
                loadKw += asset.capacityKw;
              }
            }
          }

          if (totalKw > 0) {
            setTotalCapacity(totalKw);
            setSolarCapacity(solarKw);
            setStorageCapacity(storageKw);
            setLoadCapacity(loadKw);
            if (batteryCount > 0) {
              setSoc(Number((batterySocSum / batteryCount).toFixed(1)));
            }
            setChargingPower(Number((currentBatteryPower / 1000).toFixed(2)));
          }
        }
      } catch (e) {
        console.error('Failed to fetch VPP telemetry:', e);
      }
    };

    void fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 4000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-6 font-sans">
      {/* Header with Global Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-white uppercase italic text-shadow-glow">
            {t('ENERLINK_NEXUS_OS')}
          </h1>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-mono">
            {t('VPP_DISPATCH')}:{' '}
            <span className="text-emerald-400 animate-pulse">{t('ACTIVE')}</span> / {t('TIER')}:
            {t('SME_OPTIMIZED')}
          </p>
        </div>

        <div className="flex gap-8">
          <GlobalMetric
            label={t('ACTIVE_ASSETS')}
            value={`47 ${t('UNIT_SITES')}`}
            icon={<Users className="w-4 h-4 text-cyan-400" />}
          />
          <GlobalMetric
            label={t('MONTHLY_SAVINGS')}
            value="+¥2.1M"
            icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
          />
          <GlobalMetric
            label={t('CARBON_REDUCTION')}
            value="-12.4%"
            icon={<Leaf className="w-4 h-4 text-lime-400" />}
          />
          <GlobalMetric
            label={t('GRID_UPTIME')}
            value="99.97%"
            icon={<ShieldCheck className="w-4 h-4 text-amber-400" />}
          />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: Resource Status & Simulation */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <SectionContainer title={t('ASSET_PORTFOLIO')} icon={<Activity className="w-4 h-4" />}>
            <div className="grid grid-cols-1 gap-4">
              <MetricBox
                label={t('TOTAL_CAPACITY')}
                value={Math.round(totalCapacity / 1000).toString()}
                unit={t('UNIT_MW')}
                color="cyan"
              />
              <MetricBox
                label={t('SOLAR_PV')}
                value={Math.round(solarCapacity / 1000).toString()}
                unit={t('UNIT_MW')}
                color="emerald"
              />
              <MetricBox
                label={t('ENERGY_STORAGE')}
                value={Math.round(storageCapacity / 1000).toString()}
                unit={t('UNIT_MW')}
                color="amber"
              />
              <MetricBox
                label={t('FLEXIBLE_LOAD')}
                value={Math.round(loadCapacity / 1000).toString()}
                unit={t('UNIT_MW')}
                color="slate"
              />
            </div>
          </SectionContainer>

          <DRSimulator isAdmin={isAdmin} />
        </div>

        {/* Center Column: Interactive Visuals */}
        <div className="col-span-12 lg:col-span-6 space-y-6">
          <EnergyFlowVisualizer />

          <div className="grid grid-cols-2 gap-6">
            <SectionContainer
              title={t('BATTERY_SOC')}
              icon={<Battery className="w-4 h-4 text-emerald-400" />}
            >
              <div className="flex items-center gap-6 py-2">
                <div className="relative w-24 h-24">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle
                      className="text-slate-800 stroke-current"
                      strokeWidth="10"
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                    ></circle>
                    <circle
                      className="text-emerald-500 stroke-current transition-all duration-1000 ease-in-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                      strokeWidth="10"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 * (1 - soc / 100)}
                      strokeLinecap="round"
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                    ></circle>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-white">{soc.toFixed(1)}%</span>
                    <span className="text-[8px] text-slate-500 font-mono">SOC</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase">
                    {t('AVAILABLE_ENERGY')}
                  </div>
                  <div className="text-sm font-bold text-white">
                    {((storageCapacity * (soc / 100)) / 1000).toFixed(1)} {t('UNIT_MWh')}
                  </div>
                  <div className="text-[10px] text-emerald-400 uppercase mt-2 italic">
                    {t('CHARGING')}: {chargingPower.toFixed(2)}
                    {t('UNIT_MW')}
                  </div>
                </div>
              </div>
            </SectionContainer>

            <SectionContainer
              title={t('ENVIRONMENTAL_IMPACT')}
              icon={<Leaf className="w-4 h-4 text-lime-400" />}
            >
              <div className="space-y-4 py-2">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">
                    {t('CARBON_REDUCED_TODAY')}
                  </div>
                  <div className="text-lg font-black text-lime-400">12.3 {t('TONS_CO2')}</div>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-lime-500 w-[70%]" />
                </div>
                <div className="text-[9px] text-slate-400 italic font-mono">
                  {t('TARGET')}: 18.0 Tons / Day
                </div>
              </div>
            </SectionContainer>
          </div>

          <FinancialSettlement />
        </div>

        {/* Right Column: AI & Stats */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <SectionContainer title={t('REALTIME_OPTIMIZATION')} icon={<Zap className="w-4 h-4" />}>
            <div className="space-y-4 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">{t('CURRENT_GRID_PRICE')}</span>
                <span className="text-white font-black">¥{price.toFixed(2)}/kWh</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">{t('DISPATCH_STATUS')}</span>
                <span className="text-emerald-400 font-bold uppercase italic">
                  {t('ACTIVE')} — {t('CHARGING')}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">{t('AI_SAVINGS_TODAY')}</span>
                <span className="text-white font-black">
                  +{savings}% {t('VS_BASELINE')}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">{t('RL_MODEL_VERSION')}</span>
                <span className="text-cyan-400 font-bold">v3.2-PROD</span>
              </div>
            </div>
          </SectionContainer>

          <SectionContainer
            title={t('AI_PREDICTION_TRENDS')}
            icon={<TrendingUp className="w-4 h-4 text-cyan-400" />}
          >
            <div className="space-y-6">
              <AccuracyGauge label={t('LOAD_PREDICTION_ACCURACY')} value={97.5} color="cyan" />
              <AccuracyGauge
                label={t('PRICE_PREDICTION_VARIANCE')}
                value={0.5}
                color="emerald"
                invert
              />
              <AccuracyGauge label={t('FAULT_SELF_DIAGNOSIS')} value={99.2} color="indigo" />
            </div>
          </SectionContainer>

          <SectionContainer
            title={t('BENEFIT_STATISTICS')}
            icon={<Zap className="w-5 h-5 text-[#00d9ff]" />}
          >
            <div className="h-[200px] flex items-end justify-between gap-1 px-2">
              {[40, 65, 45, 90, 55, 80, 70].map((h, i) => (
                <div
                  key={i}
                  className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-sm"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 px-1 text-[10px] text-slate-500 font-mono">
              <span>{t('MON')}</span>
              <span>{t('WED')}</span>
              <span>{t('FRI')}</span>
              <span>{t('SUN')}</span>
            </div>
          </SectionContainer>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function GlobalMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-2 text-[10px] uppercase tracking-widest text-slate-500 mb-1">
        {icon} {label}
      </div>
      <div className="text-xl font-black text-white">{value}</div>
    </div>
  );
}

function SectionContainer({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MetricBox({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    slate: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  };

  return (
    <div
      className={`p-4 rounded-xl border ${colorMap[color]} group transition-all hover:bg-opacity-20`}
    >
      <div className="text-[10px] uppercase mb-1 opacity-70">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black">{value}</span>
        <span className="text-[10px] opacity-50 font-mono">{unit}</span>
      </div>
    </div>
  );
}

function AccuracyGauge({
  label,
  value,
  color,
  invert,
}: {
  label: string;
  value: number;
  color: string;
  invert?: boolean;
}) {
  const progressColor =
    color === 'cyan' ? 'bg-cyan-400' : color === 'emerald' ? 'bg-emerald-400' : 'bg-indigo-400';
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1 font-mono">
        <span className="text-slate-500">{label}</span>
        <span className="text-white">
          {value}
          {invert ? '' : '%'}
        </span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${progressColor}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
