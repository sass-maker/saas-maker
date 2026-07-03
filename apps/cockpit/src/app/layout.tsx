import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { GlobalNamePolyfill } from '@/components/GlobalNamePolyfill';
import { ThemeProvider } from '@/components/theme-provider';
import { MonitoringProvider } from '@/components/monitoring-provider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Foundry Cockpit',
    template: '%s | Foundry',
  },
  description:
    'Monitor and manage your project fleet — AI, changelog, testimonials, roadmap and more.',
  metadataBase: new URL('https://app.sassmaker.com'),
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <GlobalNamePolyfill />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MonitoringProvider>{children}</MonitoringProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
