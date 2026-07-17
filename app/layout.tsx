import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { MonitoringProvider } from './monitoring-provider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://domains.sassmaker.com'),
  title: 'drank · Track Domain Ratings in Your Browser',
  description:
    'A High Signal research tool for tracking the authority score of popular sites and your own — entirely in your browser, with no sign-up or server storage.',
  icons: {
    icon: '/favicon.ico',
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'drank · Track Domain Ratings in Your Browser',
    description:
      'A High Signal research tool for domain authority. No account, no server — everything lives in this tab.',
    url: 'https://domains.sassmaker.com',
    type: 'website',
    images: [{ url: '/globe.svg', alt: 'drank domain rating tracker' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'drank · Track Domain Ratings in Your Browser',
    description:
      'A High Signal research tool for domain authority. No account, no server — everything lives in this tab.',
    images: ['/globe.svg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div id="drank-lcp-shell" className="bg-zinc-950 text-zinc-200" aria-hidden="true">
          <div className="mx-auto max-w-7xl px-6 pt-10 pb-6">
            <div className="text-6xl font-semibold tracking-[-3.2px] text-white">
              Track Domain Ratings.
              <br />
              100% in your browser.
            </div>
          </div>
        </div>
        <MonitoringProvider>{children}</MonitoringProvider>
      </body>
    </html>
  );
}
