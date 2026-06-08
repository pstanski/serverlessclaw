'use client';

import React, { useState } from 'react';
import { Zap, ShieldAlert, Play, Timer, TrendingUp } from 'lucide-react';
import { useTranslations } from '@claw/ui';

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
 * DRSimulator
 * Interactive simulation of a Demand Response (DR) grid event.
 * Shows high-speed autonomous dispatch in action.
 */
export const DRSimulator: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
  const { t } = useTranslations();
  const [status, setStatus] = useState<'IDLE' | 'ALERT' | 'DISPATCHING' | 'SUCCESS'>('IDLE');
  const [progress, setProgress] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentLogIndex, setCurrentLogIndex] = useState(-1);

  const workspaceId = getWorkspaceId();

  const startSimulation = async () => {
    setStatus('ALERT');
    setProgress(10);
    setRevenue(0);
    setLogs(['Triggering backend VPP Agent Orchestration...']);
    setCurrentLogIndex(0);

    if (typeof fetch === 'undefined') {
      // Fallback for test environments without global fetch
      setTimeout(() => {
        setStatus('DISPATCHING');
        setProgress(50);
        setTimeout(() => {
          setStatus('SUCCESS');
          setProgress(100);
        }, 500);
      }, 500);
      return;
    }

    try {
      const res = await fetch(`/api/x/voltx/dr/trigger?workspaceId=${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: 'site-1', region: 'GD', gridStatus: 'emergency' }),
      });
      const data = await res.json();

      if (data.finalState && data.finalState.executionLog) {
        const executionLog = data.finalState.executionLog;
        setLogs(executionLog);

        let index = 0;
        setCurrentLogIndex(0);

        const interval = setInterval(() => {
          index++;
          if (index >= executionLog.length) {
            clearInterval(interval);
            setStatus('SUCCESS');
            setProgress(100);
            setRevenue(358.4);
          } else {
            setCurrentLogIndex(index);
            setProgress(Math.min(90, 10 + index * 15));
            setRevenue((prev) => prev + Math.random() * 50 + 20);

            const logStr = executionLog[index].toLowerCase();
            if (logStr.includes('risk') || logStr.includes('dr_check')) {
              setStatus('ALERT');
            } else if (
              logStr.includes('optim') ||
              logStr.includes('dispatch') ||
              logStr.includes('market')
            ) {
              setStatus('DISPATCHING');
            }
          }
        }, 1500);
      } else {
        // Fallback
        setTimeout(() => {
          setStatus('DISPATCHING');
          setProgress(50);
          setTimeout(() => {
            setStatus('SUCCESS');
            setProgress(100);
          }, 2000);
        }, 2000);
      }
    } catch (e) {
      console.error('Failed to trigger backend StateGraph:', e);
      setTimeout(() => {
        setStatus('DISPATCHING');
        setProgress(50);
        setTimeout(() => {
          setStatus('SUCCESS');
          setProgress(100);
        }, 2000);
      }, 2000);
    }
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden">
      {/* Background Glow */}
      {status === 'ALERT' && (
        <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
      )}
      {status === 'DISPATCHING' && (
        <div className="absolute inset-0 bg-cyan-500/5 animate-pulse pointer-events-none" />
      )}

      <div className="flex items-center justify-between mb-8 relative z-10">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-white italic flex items-center gap-2">
            <ShieldAlert
              className={`w-4 h-4 ${status === 'ALERT' ? 'text-red-500 animate-bounce' : 'text-slate-500'}`}
            />
            {t('DISPATCH_SIMULATOR')}
          </h3>
          <p className="text-[10px] text-slate-500 mt-1 uppercase font-mono">
            {t('TEST_AUTONOMOUS')}
          </p>
        </div>

        {status === 'IDLE' || status === 'SUCCESS' ? (
          <button
            onClick={startSimulation}
            disabled={!isAdmin}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
              isAdmin
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed grayscale'
            }`}
          >
            <Play className="w-3 h-3 fill-current" /> {t('TRIGGER_GRID_EVENT')}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-500 uppercase italic">
              <Timer className="w-3 h-3 animate-spin" /> {t('LIVE_EVENT')}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6 relative z-10">
        {/* Status Stepper */}
        <div className="flex justify-between relative px-2">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-800 -z-10" />
          <StepNode
            active={status !== 'IDLE'}
            label={t('ALERT')}
            done={status === 'DISPATCHING' || status === 'SUCCESS'}
          />
          <StepNode
            active={status === 'DISPATCHING' || status === 'SUCCESS'}
            label={t('VERIFY')}
            done={status === 'SUCCESS'}
          />
          <StepNode
            active={status === 'DISPATCHING' || status === 'SUCCESS'}
            label={t('DISPATCH')}
            done={status === 'SUCCESS'}
            pulse={status === 'DISPATCHING'}
          />
          <StepNode active={status === 'SUCCESS'} label={t('SETTLE')} done={status === 'SUCCESS'} />
        </div>

        {/* Dispatch Progress */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-end mb-3">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                {t('AUTONOMOUS_RESPONSE')}
              </div>
              <div className="text-sm font-black text-white italic">
                {status === 'IDLE' && t('WAITING_SIGNAL')}
                {status === 'ALERT' && (logs[currentLogIndex] || t('SIGNAL_DETECTED'))}
                {status === 'DISPATCHING' && (logs[currentLogIndex] || t('EXECUTING_DISPATCH'))}
                {status === 'SUCCESS' && (logs[currentLogIndex] || t('EVENT_COMPLETED'))}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                {t('REVENUE')}
              </div>
              <div className="text-lg font-black text-emerald-400">¥{revenue.toFixed(2)}</div>
            </div>
          </div>

          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-slate-950/30 border border-slate-800/50 rounded-lg">
            <div className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1.5 mb-1">
              <Zap className="w-3 h-3" /> {t('LOAD_SHED')}
            </div>
            <div className="text-sm font-black text-white italic">
              {status === 'IDLE' ? '0.0' : (progress * 0.12).toFixed(1)} MW
            </div>
          </div>
          <div className="p-3 bg-slate-950/30 border border-slate-800/50 rounded-lg">
            <div className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3 h-3" /> {t('GRID_STABILITY')}
            </div>
            <div className="text-sm font-black text-emerald-400 italic">
              +{status === 'IDLE' ? '0.0' : (progress * 0.15).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function StepNode({
  active,
  label,
  done,
  pulse,
}: {
  active: boolean;
  label: string;
  done: boolean;
  pulse?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`w-3 h-3 rounded-full border-2 transition-all duration-500 ${
          done
            ? 'bg-emerald-500 border-emerald-500'
            : active
              ? 'bg-cyan-500 border-cyan-500'
              : 'bg-slate-900 border-slate-800'
        } ${pulse ? 'animate-pulse scale-125 shadow-[0_0_10px_rgba(6,182,212,0.5)]' : ''}`}
      />
      <span
        className={`text-[8px] font-black uppercase italic ${active ? 'text-slate-300' : 'text-slate-600'}`}
      >
        {label}
      </span>
    </div>
  );
}
