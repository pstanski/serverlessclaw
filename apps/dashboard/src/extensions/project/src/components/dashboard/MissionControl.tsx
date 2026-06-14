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

interface BatteryDegradation {
  efcToday: number;
  efcTotal: number;
  calendarDegradationCostYuan: number;
  cycleDegradationCostYuan: number;
  projectedEolYears: number;
}

interface EvFleetData {
  pluggedInCount: number;
  totalChargers: number;
  activeV2gPowerKw: number;
  dailyDemandMetKwh: number;
  dailyDemandTargetKwh: number;
}

interface MarketBid {
  product: string;
  direction: 'BUY' | 'SELL';
  quantityKw: number;
  priceYuanPerKwh: number;
  status: string;
}

interface MarketTradingData {
  activeBiddingStrategy: string;
  valueAtRiskYuan: number;
  varPercent: number;
  activeBids: MarketBid[];
}

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

  // New state variables for detailed telemetry
  const [degradation, setDegradation] = React.useState<BatteryDegradation | null>(null);
  const [evFleet, setEvFleet] = React.useState<EvFleetData | null>(null);
  const [marketTrading, setMarketTrading] = React.useState<MarketTradingData | null>(null);

  const [agentLogs, setAgentLogs] = React.useState<string[]>([
    `[${new Date().toLocaleTimeString()}] [load_forecast] Completed: 96 points, avg=450kW`,
    `[${new Date().toLocaleTimeString()}] [price_forecast] Predicted evening peak at 22:00 (¥1.08/kWh)`,
    `[${new Date().toLocaleTimeString()}] [risk_assessment] Real-time anomaly check: NOMINAL. VaR risk score: 0.12`,
    `[${new Date().toLocaleTimeString()}] [dr_check] Grid frequency normal. No active demand response events.`,
    `[${new Date().toLocaleTimeString()}] [market_trading] Nash bidding optimal strategy registered: Sell 350kW @ ¥0.87/kWh`,
    `[${new Date().toLocaleTimeString()}] [energy_optimization] Dispatch charging setpoints issued to bess-1`,
    `[${new Date().toLocaleTimeString()}] [carbon_report] Carbon report updated. Avoided emissions: 12.3 kgCO2.`,
  ]);

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
    const logsPool = [
      '[load_forecast] Re-fetching weather data. XGBoost load prediction model refreshed.',
      '[price_forecast] Spot market price delta recognized. Spot arbitrage threshold set to ¥0.35/kWh.',
      '[risk_assessment] Anomaly check: battery thermal sensor reading normal (32.4°C).',
      '[risk_assessment] VaR evaluation: 95% confidence on-peak volatility within bounds.',
      '[dr_check] VTN polling completed: no curtailment signals received.',
      '[market_trading] Day-ahead market clearing simulated. Target schedule cleared at 100%.',
      '[energy_optimization] Shifting flexible HVAC load (load-1) by 25kW to avoid peak demand charge.',
      '[energy_optimization] Battery SOC: 68.4%. Continuing normal peak arbitrage cycle.',
      '[carbon_report] Marginal grid emission offset recorded: 0.587 kg CO2/kWh for East regional grid.',
      '[iec61850_resilience] IEC 61850 GOOSE link active. Network latency stable at 8.2ms.',
    ];

    const interval = setInterval(() => {
      setAgentLogs((prev) => {
        const nextLog = `[${new Date().toLocaleTimeString()}] ${logsPool[Math.floor(Math.random() * logsPool.length)]}`;
        return [...prev.slice(1), nextLog];
      });
    }, 6000);
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
          let degData: BatteryDegradation | null = null;
          let evData: EvFleetData | null = null;
          let mktData: MarketTradingData | null = null;

          for (const site of data.sites) {
            if (site.marketTrading) {
              mktData = site.marketTrading;
            }
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
                if (asset.telemetry.degradation) {
                  degData = asset.telemetry.degradation;
                }
              } else if (asset.type === 'EV' || asset.type === 'CHARGING_PILE') {
                if (asset.telemetry.evFleet) {
                  evData = asset.telemetry.evFleet;
                }
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
            if (degData) setDegradation(degData);
            if (evData) setEvFleet(evData);
            if (mktData) setMarketTrading(mktData);
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
          {evFleet && (
            <SectionContainer
              title={t('EV_FLEET_STATUS')}
              icon={<Zap className="w-4 h-4 text-blue-400" />}
            >
              <div className="space-y-3.5 text-xs font-mono">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-950/40 border border-slate-800/60 rounded-xl">
                    <div className="text-[9px] text-slate-500 uppercase">
                      {t('CHARGERS_ACTIVE')}
                    </div>
                    <div className="text-base font-black text-white mt-1">
                      {evFleet.pluggedInCount} / {evFleet.totalChargers}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950/40 border border-slate-800/60 rounded-xl">
                    <div className="text-[9px] text-slate-500 uppercase">{t('V2G_DISPATCH')}</div>
                    <div className="text-base font-black text-emerald-400 mt-1">
                      {evFleet.activeV2gPowerKw > 0 ? `${evFleet.activeV2gPowerKw} kW` : 'OFF'}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>{t('DAILY_DEMAND_MET')}</span>
                    <span className="text-slate-300">
                      {evFleet.dailyDemandMetKwh} / {evFleet.dailyDemandTargetKwh} kWh
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{
                        width: `${(evFleet.dailyDemandMetKwh / evFleet.dailyDemandTargetKwh) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </SectionContainer>
          )}
        </div>

        {/* Center Column: Interactive Visuals */}
        <div className="col-span-12 lg:col-span-6 space-y-6">
          <EnergyFlowVisualizer />

          <div className="grid grid-cols-2 gap-6">
            <SectionContainer
              title={t('BATTERY_SOC')}
              icon={<Battery className="w-4 h-4 text-emerald-400" />}
            >
              <div className="flex flex-col gap-4 py-2">
                <div className="flex items-center gap-6">
                  <div className="relative w-20 h-20">
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
                      <span className="text-lg font-black text-white">{soc.toFixed(1)}%</span>
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

                {degradation && (
                  <div className="border-t border-slate-800/80 pt-3 mt-1 space-y-2 text-[10px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        {t('EFC_TODAY')} / {t('EFC_TOTAL')}
                      </span>
                      <span className="text-slate-300 font-bold">
                        {degradation.efcToday} / {degradation.efcTotal}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        {t('CALENDAR_AGING')} / {t('CYCLE_AGING')}
                      </span>
                      <span className="text-slate-300">
                        ¥{degradation.calendarDegradationCostYuan} / ¥
                        {degradation.cycleDegradationCostYuan}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">{t('PROJECTED_EOL')}</span>
                      <span className="text-cyan-400 font-black px-1.5 py-0.5 bg-cyan-950/40 border border-cyan-800/30 rounded">
                        {degradation.projectedEolYears} Years
                      </span>
                    </div>
                  </div>
                )}
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

          <SectionContainer
            title={t('AI_AGENT_COMMAND_TRACE')}
            icon={<Activity className="w-4 h-4 text-emerald-400 animate-pulse" />}
          >
            <div className="bg-black/60 border border-slate-800/60 rounded-xl p-4 font-mono text-[10px] text-emerald-400/90 h-[150px] overflow-y-auto space-y-1.5 shadow-inner">
              {agentLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="leading-relaxed border-l-2 border-emerald-800/40 pl-2 hover:border-emerald-500 transition-colors"
                >
                  {log}
                </div>
              ))}
            </div>
          </SectionContainer>
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

          {marketTrading && (
            <SectionContainer
              title={t('MARKET_BIDDING_LEDGER')}
              icon={<TrendingUp className="w-4 h-4 text-cyan-400" />}
            >
              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-500">{t('ACTIVE_BIDDING_STRATEGY')}</span>
                  <span className="text-cyan-400 font-bold px-1.5 py-0.5 bg-cyan-950/50 border border-cyan-800/40 rounded text-[10px]">
                    {marketTrading.activeBiddingStrategy}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-500">{t('VALUE_AT_RISK')}</span>
                  <span className="text-red-400 font-black">
                    ¥{marketTrading.valueAtRiskYuan} ({marketTrading.varPercent}%)
                  </span>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="text-[10px] text-slate-500 uppercase">{t('ACTIVE_BIDS')}</div>
                  {marketTrading.activeBids.map((bid, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center bg-slate-950/40 border border-slate-800/80 p-2 rounded-lg text-[10px]"
                    >
                      <span className="text-slate-400 font-bold">{bid.product}</span>
                      <span
                        className={bid.direction === 'SELL' ? 'text-emerald-400' : 'text-blue-400'}
                      >
                        {bid.direction} {bid.quantityKw}kW
                      </span>
                      <span className="text-slate-400">¥{bid.priceYuanPerKwh}/kWh</span>
                      <span
                        className={`px-1 rounded text-[8px] font-black ${bid.status === 'CLEARED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/30' : 'bg-amber-950 text-amber-400 border border-amber-800/30'}`}
                      >
                        {bid.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionContainer>
          )}
        </div>

        {/* Full-width Scenario Matrix */}
        <div className="col-span-12 mt-6">
          <SectionContainer
            title={t('STRATEGY_COMPARATOR')}
            icon={<Activity className="w-5 h-5 text-cyan-400" />}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-widest text-[9px]">
                    <th className="py-3 px-4">Scenario</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4 text-right">Daily Cost</th>
                    <th className="py-3 px-4 text-right">Savings vs Base</th>
                    <th className="py-3 px-4 text-right">Peak Demand</th>
                    <th className="py-3 px-4 text-right">EV Charge met</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  <tr className="hover:bg-slate-900/20 text-slate-300">
                    <td className="py-3.5 px-4 font-bold">A (Grid Base)</td>
                    <td className="py-3.5 px-4">Heuristic</td>
                    <td className="py-3.5 px-4 text-right">¥5,500.00</td>
                    <td className="py-3.5 px-4 text-right text-slate-500">-</td>
                    <td className="py-3.5 px-4 text-right">590 kW</td>
                    <td className="py-3.5 px-4 text-right">245 kWh</td>
                  </tr>
                  <tr className="hover:bg-slate-900/20 text-slate-300">
                    <td className="py-3.5 px-4 font-bold">B (PV + Storage)</td>
                    <td className="py-3.5 px-4">AI (LP)</td>
                    <td className="py-3.5 px-4 text-right">¥4,950.00</td>
                    <td className="py-3.5 px-4 text-right text-emerald-400 font-bold">+¥550.00</td>
                    <td className="py-3.5 px-4 text-right text-cyan-400">540 kW</td>
                    <td className="py-3.5 px-4 text-right">245 kWh</td>
                  </tr>
                  <tr className="hover:bg-cyan-950/20 text-white border border-cyan-500/20 bg-cyan-950/5">
                    <td className="py-4 px-4 font-bold flex items-center gap-1.5 text-cyan-400">
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />C
                      (Joint AI)
                    </td>
                    <td className="py-4 px-4 text-cyan-400 font-bold">Co-Optimized</td>
                    <td className="py-4 px-4 text-right font-black text-cyan-400">¥4,747.00</td>
                    <td className="py-4 px-4 text-right text-emerald-400 font-black bg-emerald-950/30 border border-emerald-800/20 rounded px-1.5 py-0.5">
                      +¥753.00
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-cyan-400">490 kW</td>
                    <td className="py-4 px-4 text-right font-bold text-cyan-400">485 kWh</td>
                  </tr>
                  <tr className="hover:bg-slate-900/20 text-slate-300">
                    <td className="py-3.5 px-4 font-bold">D (Siloed Rules)</td>
                    <td className="py-3.5 px-4">Independent</td>
                    <td className="py-3.5 px-4 text-right">¥4,897.00</td>
                    <td className="py-3.5 px-4 text-right text-emerald-400 font-bold">+¥603.00</td>
                    <td className="py-3.5 px-4 text-right">590 kW</td>
                    <td className="py-3.5 px-4 text-right">245 kWh</td>
                  </tr>
                  <tr className="hover:bg-slate-900/20 text-slate-300">
                    <td className="py-3.5 px-4 font-bold">E (EV + Load)</td>
                    <td className="py-3.5 px-4">Heuristic</td>
                    <td className="py-3.5 px-4 text-right">¥5,280.00</td>
                    <td className="py-3.5 px-4 text-right text-emerald-400 font-bold">+¥220.00</td>
                    <td className="py-3.5 px-4 text-right text-cyan-400">570 kW</td>
                    <td className="py-3.5 px-4 text-right">400 kWh</td>
                  </tr>
                </tbody>
              </table>
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
