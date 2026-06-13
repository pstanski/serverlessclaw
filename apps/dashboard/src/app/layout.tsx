import { Inter, JetBrains_Mono } from 'next/font/google';
import '../globals.css';
import { ConfigManager } from '@claw/core/lib/registry/config';
import { CONFIG_KEYS } from '@claw/core/lib/constants';
import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const appTitle = process.env.NEXT_PUBLIC_APP_TITLE || 'ClawCenter';
  const favicon = process.env.NEXT_PUBLIC_APP_FAVICON || '/favicon.ico';

  return {
    title: {
      template: `%s | ${appTitle}`,
      default: appTitle,
    },
    icons: {
      icon: favicon,
      shortcut: favicon,
      apple: favicon,
    },
  };
}

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialLocale: 'en' | 'cn' = 'cn';
  try {
    const locale = await ConfigManager.getTypedConfig<string>(CONFIG_KEYS.ACTIVE_LOCALE, 'cn');
    initialLocale = (locale === 'en' ? 'en' : 'cn') as 'en' | 'cn';
  } catch (err) {
    console.error('[RootLayout] Failed to fetch initial locale:', err);
  }

  return (
    <html
      lang={initialLocale}
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex bg-background text-foreground font-mono text-base antialiased"
      >
        <style>{`
          :root {
            --brand-primary: ${process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#008f5a'};
            --cyber-blue: ${process.env.NEXT_PUBLIC_ACCENT_COLOR || '#007a8a'};
          }
          .dark {
            --brand-primary: ${process.env.NEXT_PUBLIC_PRIMARY_COLOR_DARK || '#00ffa3'};
            --cyber-blue: ${process.env.NEXT_PUBLIC_ACCENT_COLOR_DARK || '#00e0ff'};
          }
        `}</style>
        {children}
      </body>
    </html>
  );
}
