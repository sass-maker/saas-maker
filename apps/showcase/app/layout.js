import './globals.css';

const SITE_URL = 'https://sassmaker.com';
const TITLE = 'Foundry — a personal fleet by Sarthak Agrawal';
const DESCRIPTION = 'A workshop dossier of twenty-something products I build and ship — and the open-source operating layer running underneath all of them.';

export const metadata = {
  title: { default: TITLE, template: '%s | Foundry' },
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'Foundry',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  keywords: ['foundry', 'sarthak agrawal', 'sassmaker', 'fleet', 'indie hacker', 'open source', 'portfolio'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <template
          id="foundry-structured-data-template"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Foundry',
              alternateName: 'SaaS Maker',
              url: SITE_URL,
              applicationCategory: 'DeveloperApplication',
              operatingSystem: 'Web',
              description: DESCRIPTION,
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              author: {
                '@type': 'Person',
                name: 'Sarthak Agrawal',
                url: 'https://github.com/sarthakagrawal927',
              },
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
