'use client';

import React from 'react';
import { Typography } from './Typography';
import { useTranslations } from './i18n';

export interface PageHeaderProps {
  titleKey: string;
  subtitleKey?: string;
  stats?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({ titleKey, subtitleKey, stats, children }: PageHeaderProps) {
  const { t } = useTranslations();

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
      <div>
        <Typography variant="h1" className="mb-1">
          {t(titleKey)}
        </Typography>
        <Typography variant="body" color="muted">
          {subtitleKey && t(subtitleKey)}
        </Typography>
      </div>
      <div className="flex flex-wrap gap-4 items-end lg:justify-end">
        {stats}
        {children}
      </div>
    </header>
  );
}
