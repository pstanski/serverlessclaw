'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Zap, TrendingUp, AlertTriangle, ShieldCheck, MapPin } from 'lucide-react';
import { useTranslations } from '@/components/Providers/TranslationsProvider';

interface GridStatusProps {
  component?: {
    data: {
      nodeId?: string;
      load?: string;
      frequency?: string;
    };
  };
}

export default function GridStatus({ component }: GridStatusProps) {
  const data = component?.data;
  const { t } = useTranslations();

  const [load, setLoad] = useState(parseFloat(data?.load || '48.20'));
  const [freq, setFreq] = useState(parseFloat(data?.frequency || '50.00'));

  useEffect(() => {
    const interval = setInterval(() => {
      setLoad((prev) => {
        const delta = (Math.random() - 0.5) * 2;
        return Number((prev + delta).toFixed(2));
      });
      setFreq((prev) => {
        const delta = (Math.random() - 0.5) * 0.05;
        // Keep within 49.9 - 50.1
        const next = prev + delta;
        return Number(Math.min(50.1, Math.max(49.9, next)).toFixed(2));
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 pb-12 font-mono">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3 italic tracking-tighter">
            <Activity className="w-6 h-6 text-cyan-400" /> {t('ENERGY_GRID')}
          </h2>
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] font-bold mt-1">
            {t('REALTIME_PERFORMANCE')}
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-emerald-400 text-xs font-black uppercase tracking-widest">
            {t('STATUS_ONLINE')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Current Load" value={`${load} MW`} icon={<Zap />} color="cyan" />
        <StatCard title="Frequency" value={`${freq} Hz`} icon={<Activity />} color="emerald" />
        <StatCard title="Market Revenue" value="+¥42,850" icon={<TrendingUp />} color="amber" />
        <StatCard title="Grid Stability" value="99.98%" icon={<ShieldCheck />} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 p-6 bg-slate-900/60 border border-slate-800 rounded-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
          <h3 className="text-white font-black uppercase tracking-widest mb-6 relative z-10 flex justify-between">
            Regional Dispatch Heatmap
            <span className="text-cyan-400 text-xs">LIVE</span>
          </h3>
          <div className="h-[300px] relative z-10 flex items-center justify-center border border-dashed border-slate-700/50 rounded-xl bg-slate-950/30">
            {/* Abstract visualization of grid nodes */}
            <div className="absolute top-1/4 left-1/4 w-12 h-12 bg-cyan-500/20 rounded-full border border-cyan-500/50 flex items-center justify-center animate-[pulse_3s_ease-in-out_infinite]">
              <MapPin className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-emerald-500/20 rounded-full border border-emerald-500/50 flex items-center justify-center animate-[pulse_4s_ease-in-out_infinite]">
              <MapPin className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="absolute bottom-1/4 left-1/2 w-10 h-10 bg-amber-500/20 rounded-full border border-amber-500/50 flex items-center justify-center animate-[pulse_2.5s_ease-in-out_infinite]">
              <MapPin className="w-4 h-4 text-amber-400" />
            </div>
            {/* Connecting lines */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: -1 }}
            >
              <line
                x1="25%"
                y1="25%"
                x2="50%"
                y2="75%"
                stroke="rgba(6,182,212,0.2)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <line
                x1="66%"
                y1="50%"
                x2="50%"
                y2="75%"
                stroke="rgba(16,185,129,0.2)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <line
                x1="25%"
                y1="25%"
                x2="66%"
                y2="50%"
                stroke="rgba(245,158,11,0.2)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            </svg>
          </div>
        </div>

        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl relative overflow-hidden">
          <h3 className="text-white font-black uppercase tracking-widest mb-6 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Recent Events
          </h3>
          <div className="space-y-4">
            {[
              {
                time: '10:42 AM',
                event: 'Frequency drop detected',
                region: 'GD-South',
                severity: 'low',
              },
              {
                time: '09:15 AM',
                event: 'Automated DR Triggered',
                region: 'ZJ-East',
                severity: 'high',
              },
              {
                time: '08:30 AM',
                event: 'Peak load warning',
                region: 'JS-North',
                severity: 'medium',
              },
            ].map((evt, i) => (
              <div
                key={i}
                className="p-3 bg-slate-950/50 rounded-lg border border-slate-800 flex flex-col gap-2"
              >
                <div className="flex justify-between items-start">
                  <span className="text-xs font-black text-slate-300">{evt.event}</span>
                  <span
                    className={`text-[9px] uppercase px-1.5 py-0.5 rounded ${
                      evt.severity === 'high'
                        ? 'bg-rose-500/20 text-rose-400'
                        : evt.severity === 'medium'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-cyan-500/20 text-cyan-400'
                    }`}
                  >
                    {evt.severity}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                  <span>{evt.region}</span>
                  <span>{evt.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    cyan: 'text-cyan-400 border-cyan-500/30 group-hover:border-cyan-500/50',
    emerald: 'text-emerald-400 border-emerald-500/30 group-hover:border-emerald-500/50',
    amber: 'text-amber-400 border-amber-500/30 group-hover:border-amber-500/50',
    blue: 'text-blue-400 border-blue-500/30 group-hover:border-blue-500/50',
  };

  return (
    <div
      className={`p-6 bg-slate-900/60 border rounded-2xl relative overflow-hidden group transition-all duration-300 ${colorMap[color] || colorMap.cyan}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="text-[10px] uppercase font-black tracking-widest text-slate-500 group-hover:text-slate-400 transition-colors">
          {title}
        </div>
        <div className="opacity-50 group-hover:opacity-100 transition-opacity">{icon}</div>
      </div>
      <div className="text-2xl font-black italic tracking-tighter text-white">{value}</div>
    </div>
  );
}
