'use client';

import React, { useState } from 'react';
import {
  Activity,
  Globe,
  Zap,
  Battery,
  Sun,
  Building,
  MapPin,
  Plus,
  Trash2,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { VppSite, DER_TYPE } from '@voltx/core/src/types';

interface AssetManagementProps {
  sites?: VppSite[];
  isAdmin?: boolean;
}

// Mock workspace context since it varies across environments
const getWorkspaceId = () => {
  if (typeof window === 'undefined') return 'default';
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('workspaceId') || 'default';
};

import { useTranslations } from '@/components/Providers/TranslationsProvider';

/**
 * AssetManagement
 * Handles VPP site registration, lifecycle, and asset mapping.
 */
export const AssetManagement: React.FC<AssetManagementProps> = ({
  sites: initialSites,
  isAdmin = true,
}) => {
  const { t } = useTranslations();
  const readOnly = !isAdmin;
  const [isAdding, setIsAdding] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [localSites, setLocalSites] = useState<VppSite[]>([]);
  const [, setLoading] = useState(true);

  const workspaceId = getWorkspaceId();

  const fetchSites = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/x/voltx/sites?workspaceId=${workspaceId}`);
      const data = await res.json();
      if (data.sites) {
        setLocalSites(data.sites);
      }
    } catch (e) {
      console.error('Failed to fetch VPP sites:', e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  React.useEffect(() => {
    // eslint-disable-next-line
    fetchSites();
  }, [fetchSites]);

  const displaySites = initialSites || localSites;

  const handleAdd = async () => {
    if (!newSiteName) return;
    try {
      const res = await fetch('/api/x/voltx/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSiteName, workspaceId }),
      });
      if (res.ok) {
        setNewSiteName('');
        setIsAdding(false);
        fetchSites();
      }
    } catch (e) {
      console.error('Failed to add site:', e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/x/voltx/sites/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchSites();
      }
    } catch (e) {
      console.error('Failed to delete site:', e);
    }
  };

  const getIcon = (type?: DER_TYPE) => {
    switch (type) {
      case DER_TYPE.SOLAR:
        return <Sun className="w-4 h-4 text-amber-400" />;
      case DER_TYPE.BATTERY:
        return <Battery className="w-4 h-4 text-emerald-400" />;
      case DER_TYPE.EV:
      case DER_TYPE.CHARGING_PILE:
        return <Zap className="w-4 h-4 text-blue-400" />;
      default:
        return <Building className="w-4 h-4 text-slate-400" />;
    }
  };

  const getAssetTypeName = (type: string) => {
    const map: Record<string, string> = {
      SOLAR: t('SOLAR_PV'),
      BATTERY: t('BATTERY_STORAGE'),
      EV: t('EV_CHARGER'),
      CHARGING_PILE: t('EV_CHARGER'),
    };
    return map[type] || type;
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3 italic tracking-tighter">
            <MapPin className="w-6 h-6 text-cyan-400" /> {t('ASSET_TOPOLOGY')}
          </h2>
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] font-bold mt-1">
            Fleet Orchestration & Node Management
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-black text-xs transition-all shadow-[0_0_20px_rgba(8,145,178,0.4)] uppercase italic tracking-wider"
          >
            <Plus className="w-4 h-4" /> {t('ADD_NEW_SITE')}
          </button>
        )}
      </div>

      {/* VPP Global Map Placeholder (Visual Polish for Investors) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 h-[320px] bg-slate-900/60 border border-slate-800 rounded-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Globe className="w-48 h-48 text-cyan-500/10 animate-[spin_60s_linear_infinite]" />
            <div className="absolute flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md border border-cyan-500/30 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-cyan-400 tracking-widest uppercase italic">
                  Global Fleet Active
                </span>
              </div>
            </div>
          </div>

          {/* Random site pips */}
          <div className="absolute top-1/4 left-1/3 w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
          <div className="absolute top-1/2 left-1/4 w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
          <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
          <div className="absolute top-1/3 right-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]" />

          <div className="absolute bottom-4 left-6 flex gap-6">
            <div className="space-y-1">
              <div className="text-[8px] text-slate-500 uppercase tracking-widest">
                Active Regions
              </div>
              <div className="text-xs font-black text-white italic">SHENZHEN / HANGZHOU</div>
            </div>
            <div className="space-y-1">
              <div className="text-[8px] text-slate-500 uppercase tracking-widest">Avg Latency</div>
              <div className="text-xs font-black text-emerald-400 italic font-mono">14.2ms</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <StatMiniBox
            label="Total Fleet Capacity"
            value="48.2 MW"
            icon={<TrendingUp className="text-cyan-400" />}
          />
          <StatMiniBox
            label="System Health"
            value="NOMINAL"
            icon={<ShieldCheck className="text-emerald-400" />}
          />
          <StatMiniBox
            label="Cloud Uplink"
            value="STABLE"
            icon={<Activity className="text-blue-400" />}
          />
        </div>
      </div>

      {isAdding && (
        <div className="p-6 bg-slate-900 border border-cyan-500/30 rounded-2xl flex gap-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black text-cyan-400 uppercase tracking-widest ml-1 italic">
              New Site Identity
            </label>
            <input
              autoFocus
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
              placeholder={t('ENTER_SITE_NAME')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500/50 transition-all font-bold"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="flex items-end gap-3 pb-0.5">
            <button
              onClick={handleAdd}
              className="px-6 py-3 bg-cyan-600 text-white rounded-xl font-black text-xs uppercase italic tracking-widest"
            >
              {t('REGISTER_SITE')}
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="px-6 py-3 bg-slate-800 text-slate-400 rounded-xl font-black text-xs uppercase italic tracking-widest hover:bg-slate-700 transition-colors"
            >
              {t('COMMON_CANCEL')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displaySites.map((site) => (
          <div
            key={site.id}
            className="group relative bg-slate-900/40 border border-slate-800 p-6 rounded-3xl hover:border-cyan-500/30 transition-all duration-500 backdrop-blur-md overflow-hidden"
          >
            {/* Gloss effect */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="flex justify-between items-start mb-6">
              <div className="space-y-1">
                <div className="text-[8px] font-black text-cyan-500 uppercase tracking-[0.3em] italic mb-1">
                  Nexus Node #{site.id.slice(0, 4).toUpperCase()}
                </div>
                <h3 className="text-xl font-black text-slate-100 group-hover:text-cyan-400 transition-colors tracking-tight">
                  {site.name}
                </h3>
                <div className="text-[10px] font-mono text-slate-500 flex items-center gap-3 pt-1">
                  <span className="bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800 text-[8px]">
                    ID: {site.id.slice(0, 12)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="uppercase tracking-widest font-black text-[8px] text-emerald-400/80 italic">
                      {t('CONNECTED')}
                    </span>
                  </span>
                </div>
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleDelete(site.id)}
                  className="p-2 text-slate-700 hover:text-rose-500 transition-all hover:bg-rose-500/10 rounded-full"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800/50 pb-2">
                <span>{t('MANAGED_ASSETS')}</span>
                <span className="text-slate-300 bg-slate-800 px-2 py-0.5 rounded-sm">
                  {site.assets?.length || 0} {t('UNITS')}
                </span>
              </div>

              {site.assets && site.assets.length > 0 ? (
                <div className="space-y-2.5">
                  {site.assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between p-3 bg-slate-950/40 rounded-2xl border border-slate-800/50 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner">
                          {getIcon(asset.type)}
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-slate-300 italic tracking-tight">
                            {t('COMMON_TOOL')} {asset.id.slice(0, 4)}
                          </div>
                          <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mt-0.5">
                            {getAssetTypeName(asset.type)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono text-emerald-400 font-black tracking-tighter">
                          {asset.capacityKw}kW
                        </div>
                        <div className="text-[8px] text-slate-600 uppercase font-bold tracking-tighter">
                          {t('CAPACITY')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-3xl bg-slate-950/10 opacity-60">
                  <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center mb-2">
                    <Building className="w-4 h-4 text-slate-700" />
                  </div>
                  <span className="text-[9px] text-slate-600 uppercase font-black tracking-widest italic">
                    {t('NO_ASSETS_REGISTERED')}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function StatMiniBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex items-center justify-between group hover:border-cyan-500/20 transition-all">
      <div className="space-y-1">
        <div className="text-[8px] text-slate-500 uppercase tracking-[0.2em] font-black">
          {label}
        </div>
        <div className="text-lg font-black text-white italic tracking-tighter">{value}</div>
      </div>
      <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-800 group-hover:scale-105 transition-transform">
        {icon}
      </div>
    </div>
  );
}
