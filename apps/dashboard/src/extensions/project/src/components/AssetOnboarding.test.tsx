import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetOnboarding } from './AssetOnboarding';
import React from 'react';

vi.mock('@claw/ui', async (importOriginal) => {
  const original = await importOriginal<any>();
  const voltxEn = await import('../../messages/en.json');
  const dashboardEn = await import('../../../../framework/apps/dashboard/messages/en.json');
  const allTranslations: Record<string, string> = {
    ...dashboardEn.default,
    ...voltxEn.default,
  };
  return {
    ...original,
    useTranslations: () => ({
      t: (key: string) => allTranslations[key] || key,
      locale: 'en',
      setLocale: async () => {},
      formatDate: (d: any) => new Date(d).toLocaleDateString('en-US'),
      formatTime: (d: any) => new Date(d).toLocaleTimeString('en-US'),
    }),
  };
});

describe('AssetOnboarding', () => {
  it('should render the "Add New Asset" button initially', () => {
    render(<AssetOnboarding onComplete={() => {}} />);
    expect(screen.getByText('Add New Asset')).toBeDefined();
  });

  it('should open the modal when "Add New Asset" is clicked', () => {
    render(<AssetOnboarding onComplete={() => {}} />);
    fireEvent.click(screen.getByText('Add New Asset'));
    expect(screen.getByRole('heading', { name: 'Register Asset' })).toBeDefined();
    expect(screen.getByPlaceholderText('e.g. Roof Solar Array 1')).toBeDefined();
  });

  it('should close the modal when "Cancel" is clicked', () => {
    render(<AssetOnboarding onComplete={() => {}} />);
    fireEvent.click(screen.getByText('Add New Asset'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('heading', { name: 'Register Asset' })).toBeNull();
    expect(screen.getByText('Add New Asset')).toBeDefined();
  });

  it('should call onComplete when the form is submitted', () => {
    const onComplete = vi.fn();
    render(<AssetOnboarding onComplete={onComplete} />);

    // Open modal
    fireEvent.click(screen.getByText('Add New Asset'));

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('e.g. Roof Solar Array 1'), {
      target: { value: 'Test Solar' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 5.5'), {
      target: { value: '10.5' },
    });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Register Asset' }));

    expect(onComplete).toHaveBeenCalled();
    expect(screen.queryByText('Register Asset')).toBeNull();
  });
});
