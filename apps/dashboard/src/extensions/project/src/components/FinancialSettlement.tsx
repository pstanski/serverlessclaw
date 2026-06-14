'use client';

import React, { useState } from 'react';
import { ArrowUpRight, TrendingUp, CheckCircle2, Receipt } from 'lucide-react';
import { useTranslations } from '@/components/Providers/TranslationsProvider';

interface SettlementData {
  totalRevenue: number;
  pendingSettlement: number;
  lastSettlementDate: string;
  transactions: {
    id: string;
    date: string;
    amount: number;
    status: 'COMPLETED' | 'PENDING';
    description: string;
  }[];
}

/**
 * FinancialSettlement
 * High-fidelity VPP revenue ledger with CN market alignment.
 */
export const FinancialSettlement: React.FC = () => {
  const { t } = useTranslations();
  const [data] = useState<SettlementData>(() => ({
    totalRevenue: 3450200.5,
    pendingSettlement: 12500.0,
    lastSettlementDate: new Date().toISOString().split('T')[0],
    transactions: [
      {
        id: 'TXN-VPP-782',
        date: new Date().toISOString().split('T')[0],
        amount: 4500.0,
        status: 'COMPLETED',
        description: t('DESC_FREQ_RESPONSE'),
      },
      {
        id: 'TXN-VPP-781',
        date: new Date().toISOString().split('T')[0],
        amount: 8000.0,
        status: 'PENDING',
        description: t('DESC_ARBITRAGE'),
      },
      {
        id: 'TXN-VPP-779',
        date: '2026-05-13',
        amount: 12400.0,
        status: 'COMPLETED',
        description: `${t('DESC_DR_EVENT')} #04`,
      },
    ],
  }));

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-800/50 pb-4">
        <Receipt className="w-5 h-5 text-cyan-400" />
        <h2 className="text-sm font-black uppercase tracking-widest text-white italic">
          {t('SETTLEMENT_LEDGER')}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="p-5 bg-slate-950/50 border border-slate-800 rounded-xl">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-2">
            {t('TOTAL_VALUE_CREATED')}
          </div>
          <div className="text-3xl font-black text-emerald-400">
            ¥{data.totalRevenue.toLocaleString()}
          </div>
        </div>
        <div className="p-5 bg-slate-950/50 border border-slate-800 rounded-xl">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-2">
            {t('PENDING_SETTLEMENT')}
          </div>
          <div className="text-3xl font-black text-amber-400">
            ¥{data.pendingSettlement.toLocaleString()}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-slate-500" /> {t('SETTLEMENT_HISTORY')}
        </h3>
        <div className="space-y-3">
          {data.transactions.map((txn) => (
            <div
              key={txn.id}
              className="flex items-center justify-between p-4 bg-slate-950/30 border border-slate-800/50 rounded-xl group hover:border-cyan-500/30 transition-all"
            >
              <div>
                <div className="text-sm font-bold text-slate-200">{txn.description}</div>
                <div className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-tighter">
                  {txn.date} • {txn.id}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-lg font-black text-emerald-400">
                  +¥{txn.amount.toLocaleString()}
                </span>
                {txn.status === 'COMPLETED' ? (
                  <span className="flex items-center gap-1 text-[8px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {t('STATUS_SETTLED')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[8px] font-black uppercase text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20 animate-pulse">
                    <ArrowUpRight className="w-3 h-3 text-amber-500" /> {t('STATUS_PENDING')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
