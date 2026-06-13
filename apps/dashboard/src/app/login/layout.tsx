import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { TranslationsProvider } from '@/components/Providers/TranslationsProvider';
import { ConfigManager } from '@claw/core/lib/registry/config';
import { CONFIG_KEYS } from '@claw/core/lib/constants';
import { ThemeProvider } from '@/components/Providers/ThemeProvider';
import { ExtensionProvider } from '@/components/Providers/ExtensionProvider';

export async function generateMetadata(): Promise<Metadata> {
  const appTitle = process.env.NEXT_PUBLIC_APP_TITLE || 'ClawCenter';
  const favicon = process.env.NEXT_PUBLIC_APP_FAVICON || '/favicon.ico';

  return {
    title: `${appTitle} | Authentication`,
    description: 'Secure access to the Command & Control Hub',
    icons: {
      icon: favicon,
      shortcut: favicon,
      apple: favicon,
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialLocale: 'en' | 'cn' = 'cn';
  try {
    const locale = await ConfigManager.getTypedConfig<string>(CONFIG_KEYS.ACTIVE_LOCALE, 'cn');
    initialLocale = (locale === 'en' ? 'en' : 'cn') as 'en' | 'cn';
  } catch (err) {
    console.debug('[Dashboard] Using default locale for auth:', err);
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <ExtensionProvider>
        <TranslationsProvider initialLocale={initialLocale}>
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: 'cyber-toast',
              classNames: {
                success: 'cyber-toast-success',
                error: 'cyber-toast-error',
                description: 'cyber-toast-description',
              },
            }}
          />
          <div className="flex-1 overflow-y-auto">{children}</div>
        </TranslationsProvider>
      </ExtensionProvider>
    </ThemeProvider>
  );
}
