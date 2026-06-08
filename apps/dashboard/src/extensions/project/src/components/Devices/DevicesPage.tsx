'use client';

import React from 'react';
import { Server, Zap, Shield, Search, Filter, Plus, MoreHorizontal, MapPin } from 'lucide-react';
import { PageHeader, useTranslations } from '@claw/ui';

interface Device {
  id: string;
  name: string;
  type: 'Inverter' | 'Battery' | 'Meter';
  status: 'online' | 'offline' | 'warning';
  location: string;
  capacity: string;
  lastSeen: string;
}

const mockDevices: Device[] = [
  {
    id: 'DEV-001',
    name: 'Main PV Inverter',
    type: 'Inverter',
    status: 'online',
    location: 'North Wing Roof',
    capacity: '50 kW',
    lastSeen: '2 mins ago',
  },
  {
    id: 'DEV-002',
    name: 'Storage Bank A',
    type: 'Battery',
    status: 'online',
    location: 'Basement Plant Room',
    capacity: '200 kWh',
    lastSeen: '1 min ago',
  },
  {
    id: 'DEV-003',
    name: 'Grid Connection Meter',
    type: 'Meter',
    status: 'warning',
    location: 'Main Switchboard',
    capacity: 'N/A',
    lastSeen: '15 mins ago',
  },
];

export function DevicesPage() {
  const { t } = useTranslations();

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <PageHeader titleKey="FLEET_MANAGEMENT" subtitleKey="FLEET_SUBTITLE" />

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t('TOTAL_ASSETS'), value: '124', icon: Server, color: 'text-blue-500' },
          { label: t('ACTIVE_POWER'), value: '1.2 MW', icon: Zap, color: 'text-yellow-500' },
          { label: t('SYSTEM_HEALTH'), value: '98%', icon: Shield, color: 'text-green-500' },
          { label: t('LOCATIONS'), value: '12', icon: MapPin, color: 'text-purple-500' },
        ].map((stat, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-white/60">{stat.label}</p>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Asset Table */}
      <div className="rounded-xl border border-white/10 bg-black/20 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-white/40" />
              <input
                placeholder={t('SEARCH_ASSETS')}
                className="h-9 w-64 rounded-lg bg-white/5 pl-9 pr-4 text-sm text-white placeholder:text-white/30 border-none focus:ring-1 focus:ring-white/20 transition-all"
              />
            </div>
            <button className="flex h-9 items-center gap-2 rounded-lg bg-white/5 px-3 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-all">
              <Filter className="h-4 w-4" />
              {t('FILTER')}
            </button>
          </div>
          <button className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20">
            <Plus className="h-4 w-4" />
            {t('ADD_DEVICE')}
          </button>
        </div>

        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="p-4 font-medium text-white/60">{t('ASSET_NAME')}</th>
              <th className="p-4 font-medium text-white/60">{t('TYPE')}</th>
              <th className="p-4 font-medium text-white/60">{t('STATUS')}</th>
              <th className="p-4 font-medium text-white/60">{t('LOCATION')}</th>
              <th className="p-4 font-medium text-white/60">{t('CAPACITY')}</th>
              <th className="p-4 font-medium text-white/60">{t('LAST_SEEN')}</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {mockDevices.map((device) => (
              <tr
                key={device.id}
                className="border-b border-white/5 hover:bg-white/5 transition-colors group"
              >
                <td className="p-4">
                  <div className="font-medium text-white">{device.name}</div>
                  <div className="text-xs text-white/40">{device.id}</div>
                </td>
                <td className="p-4">
                  <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-white/60 border border-white/5">
                    {device.type}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${
                        device.status === 'online'
                          ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                          : device.status === 'warning'
                            ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]'
                            : 'bg-red-500'
                      }`}
                    />
                    <span className="capitalize text-white/80">{device.status}</span>
                  </div>
                </td>
                <td className="p-4 text-white/60">{device.location}</td>
                <td className="p-4 text-white/60 font-mono">{device.capacity}</td>
                <td className="p-4 text-white/40">{device.lastSeen}</td>
                <td className="p-4 text-right">
                  <button className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-all opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="p-4 bg-white/5 flex items-center justify-between border-t border-white/5 text-white/40 text-xs">
          <div>{t('SHOWING_ASSETS')}</div>
          <div className="flex items-center gap-4">
            <button className="hover:text-white transition-all disabled:opacity-30" disabled>
              {t('PREVIOUS')}
            </button>
            <button className="hover:text-white transition-all">{t('NEXT')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
