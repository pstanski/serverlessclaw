'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Zap, Sun, Battery, Building, MapPin, Activity } from 'lucide-react';
import { VppSite, DER_TYPE } from '@voltx/core/src/types';

interface AssetManagementProps {
  sites?: VppSite[];
  onAddSite?: (site: Partial<VppSite>) => void;
  onDeleteSite?: (id: string) => void;
  isAdmin?: boolean;
}

const getWorkspaceId = () => {
  if (typeof window === 'undefined') return 'default';
  const urlParams = new URLSearchParams(window.location.search);
  return (
    urlParams.get('workspaceId') ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('claw_active_workspace') : null) ||
    'default'
  );
};

export const AssetManagement: React.FC<AssetManagementProps> = ({
  sites,
  onAddSite,
  onDeleteSite,
  isAdmin = false,
}) => {
  const readOnly = !isAdmin;
  const [isAdding, setIsAdding] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [localSites, setLocalSites] = useState<VppSite[]>([]);
  const [_loading, setLoading] = useState(true);

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
    fetchSites();
  }, [fetchSites]);

  const displaySites = sites || localSites;

  const handleAdd = async () => {
    if (!newSiteName) return;
    const newSite: VppSite = {
      id: 'site-' + Math.random().toString(36).substring(2, 11),
      name: newSiteName,
      region: 'GD',
      status: 'ACTIVE',
      assets: [],
      createdAt: new Date().toISOString(),
    };
    try {
      await fetch(`/api/x/voltx/sites?workspaceId=${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSite),
      });
      if (onAddSite) {
        onAddSite(newSite);
      }
      await fetchSites();
    } catch (e) {
      console.error('Failed to register site:', e);
    }
    setNewSiteName('');
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/x/voltx/sites?siteId=${id}&workspaceId=${workspaceId}`, {
        method: 'DELETE',
      });
      if (onDeleteSite) {
        onDeleteSite(id);
      }
      await fetchSites();
    } catch (e) {
      console.error('Failed to delete site:', e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Building className="w-5 h-5 text-cyan-400" />
          VPP Sites
        </h3>
        {!readOnly && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400 text-sm hover:bg-cyan-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Site
          </button>
        )}
      </div>

      {isAdding && (
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
          <input
            autoFocus
            type="text"
            placeholder="Site Name (e.g. Shenzhen East)"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
            value={newSiteName}
            onChange={(e) => setNewSiteName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-slate-400 text-sm hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="px-4 py-1.5 bg-cyan-600 text-white text-sm font-bold rounded-lg hover:bg-cyan-500 transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displaySites.map((site) => (
          <div
            key={site.id}
            className="group p-4 bg-slate-900/40 border border-slate-800 rounded-xl hover:border-slate-700 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                  {site.name}
                </h4>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-[10px] text-slate-500 uppercase">
                    <MapPin className="w-3 h-3" />
                    {site.region}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-black italic">
                    <Activity className="w-3 h-3" />
                    {site.status}
                  </span>
                </div>
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleDelete(site.id)}
                  className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                <span>Assets</span>
                <span>Capacity</span>
              </div>
              {site.assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between py-1 border-t border-slate-800/50"
                >
                  <div className="flex items-center gap-2">
                    {asset.type === DER_TYPE.SOLAR && <Sun className="w-3 h-3 text-emerald-400" />}
                    {asset.type === DER_TYPE.BATTERY && (
                      <Battery className="w-3 h-3 text-amber-400" />
                    )}
                    {asset.type === DER_TYPE.EV && <Zap className="w-3 h-3 text-cyan-400" />}
                    <span className="text-xs text-slate-300 capitalize">
                      {asset.type.toLowerCase()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-white">{asset.capacityKw}</span>
                    <span className="text-[10px] text-slate-500 ml-1">kW</span>
                  </div>
                </div>
              ))}
              {site.assets.length === 0 && (
                <div className="text-center py-4 bg-slate-800/20 rounded-lg border border-dashed border-slate-800">
                  <span className="text-[10px] text-slate-600 uppercase">No assets registered</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
