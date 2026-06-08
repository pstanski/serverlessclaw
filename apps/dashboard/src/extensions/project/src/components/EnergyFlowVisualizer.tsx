'use client';

import React, { useEffect, useState } from 'react';
import { Zap, Battery, Home, ArrowRightLeft } from 'lucide-react';

interface FlowData {
  solar: number;
  grid: number;
  battery: number;
  load: number;
}

/**
 * EnergyFlowVisualizer
 * High-fidelity representation of real-time power distribution.
 */
export const EnergyFlowVisualizer: React.FC = () => {
  const [data, setData] = useState<FlowData>({
    solar: 45.2,
    grid: -12.5,
    battery: 5.2,
    load: 37.9,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => ({
        solar: prev.solar + (Math.random() - 0.5) * 0.5,
        grid: prev.grid + (Math.random() - 0.5) * 1.2,
        battery: prev.battery + (Math.random() - 0.5) * 0.2,
        load: prev.load + (Math.random() - 0.5) * 0.8,
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4" /> Live Dispatch Flow
        </h3>
        <span className="text-[10px] font-mono text-emerald-400 animate-pulse uppercase">
          Realtime Telemetry
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FlowCard
          label="Solar Generation"
          value={data.solar}
          unit="kW"
          icon={<Zap className="w-4 h-4 text-amber-400" />}
          color="amber"
        />
        <FlowCard
          label="Grid Interaction"
          value={Math.abs(data.grid)}
          unit="kW"
          icon={<ArrowRightLeft className="w-4 h-4 text-cyan-400" />}
          color="cyan"
          suffix={data.grid > 0 ? '(IN)' : '(OUT)'}
        />
        <FlowCard
          label="Battery State"
          value={data.battery}
          unit="kW"
          icon={<Battery className="w-4 h-4 text-emerald-400" />}
          color="emerald"
          suffix={data.battery > 0 ? '(CHG)' : '(DIS)'}
        />
        <FlowCard
          label="Facility Load"
          value={data.load}
          unit="kW"
          icon={<Home className="w-4 h-4 text-purple-400" />}
          color="purple"
        />
      </div>
    </div>
  );
};

function FlowCard({
  label,
  value,
  unit,
  icon,
  color,
  suffix,
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  color: string;
  suffix?: string;
}) {
  const colorMap: Record<string, string> = {
    amber: 'border-amber-500/20 bg-amber-500/5',
    cyan: 'border-cyan-500/20 bg-cyan-500/5',
    emerald: 'border-emerald-500/20 bg-emerald-500/5',
    purple: 'border-purple-500/20 bg-purple-500/5',
  };

  return (
    <div className={`p-4 border rounded-xl ${colorMap[color]} transition-all hover:bg-opacity-10`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] uppercase font-bold text-slate-500">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-black text-white">{value.toFixed(1)}</span>
        <span className="text-[10px] font-mono text-slate-400 uppercase">{unit}</span>
        {suffix && <span className="text-[9px] font-mono opacity-60 italic">{suffix}</span>}
      </div>
    </div>
  );
}
