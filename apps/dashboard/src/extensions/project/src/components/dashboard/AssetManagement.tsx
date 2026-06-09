'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Zap, Sun, Battery, Building, MapPin, Activity } from 'lucide-react';
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

/**
 * AssetManagement
 * Handles VPP site registration, lifecycle, and asset mapping.
 */
export const AssetManagement: React.FC<AssetManagementProps> = ({
  sites: initialSites,
  isAdmin = true,
}) => {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-white flex items-center gap-2 italic">
          <MapPin className="w-5 h-5 text-cyan-400" /> VPP Asset Topology
        </h2>
        {!readOnly && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold text-xs transition-all shadow-[0_0_15px_rgba(8,145,178,0.3)]"
          >
            <Plus className="w-4 h-4" /> Add New Site
          </button>
        )}
      </div>

      {isAdding && (
        <div className="p-4 bg-slate-900 border border-cyan-500/30 rounded-xl flex gap-3">
          <input
            autoFocus
            value={newSiteName}
            onChange={(e) => setNewSiteName(e.target.value)}
            placeholder="Enter site name..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-cyan-500/50"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-bold text-xs"
          >
            Register
          </button>
          <button
            onClick={() => setIsAdding(false)}
            className="px-4 py-2 bg-slate-800 text-slate-400 rounded-lg font-bold text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displaySites.map((site) => (
          <div
            key={site.id}
            className="group relative bg-slate-900/40 border border-slate-800 p-5 rounded-2xl hover:border-cyan-500/30 transition-all duration-300 backdrop-blur-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-100 group-hover:text-cyan-400 transition-colors">
                  {site.name}
                </h3>
                <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                  <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    ID: {site.id.slice(0, 8)}
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full" /> Connected
                  </span>
                </div>
              </div>
              {!readOnly && (
                <button className="p-2 text-slate-600 hover:text-rose-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <span>Managed Assets</span>
                <span className="text-slate-300">{site.assets?.length || 0} units</span>
              </div>

              {site.assets && site.assets.length > 0 ? (
                <div className="space-y-2">
                  {site.assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between p-2 bg-slate-950/50 rounded-lg border border-slate-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                          {getIcon(asset.type)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-300">Unit {asset.id.slice(0, 4)}</div>
                          <div className="text-[9px] text-slate-600 uppercase font-black">
                            {asset.type}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono text-emerald-400 font-bold">
                          {asset.capacityKw}kW
                        </div>
                        <div className="text-[8px] text-slate-500 uppercase">Capacity</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 flex flex-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
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
