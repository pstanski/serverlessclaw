'use client';

import React, { useState } from 'react';
import { PlusCircle, X, ShieldCheck } from 'lucide-react';
import { useTranslations } from '@claw/ui';

interface AssetOnboardingProps {
  onComplete: () => void;
}

export const AssetOnboarding: React.FC<AssetOnboardingProps> = ({ onComplete }) => {
  const { t } = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [type, setType] = useState('solar');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(`Onboarding Asset: ${assetName}, ${capacity}kW, ${type}`);
    setIsOpen(false);
    onComplete();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium transition-colors"
      >
        <PlusCircle className="w-4 h-4" />
        {t('ADD_NEW_ASSET')}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-zinc-100">{t('REGISTER_ASSET')}</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              {t('ASSET_NAME_LABEL')}
            </label>
            <input
              type="text"
              required
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="e.g. Roof Solar Array 1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              {t('CAPACITY_KW')}
            </label>
            <input
              type="number"
              required
              min="0.1"
              step="0.1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="e.g. 5.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              {t('ASSET_TYPE')}
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="solar">{t('SOLAR_PV')}</option>
              <option value="battery">{t('BATTERY_STORAGE')}</option>
              <option value="ev">{t('EV_CHARGER')}</option>
            </select>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              {t('COMMON_CANCEL')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium transition-colors"
            >
              {t('REGISTER_ASSET')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
