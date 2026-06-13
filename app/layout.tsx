import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "drank · Track Domain Ratings in Your Browser",
  description: "See the authority score of ~45 popular sites and your own — 100% in your browser. Free Ahrefs API, no sign-up, no server. Your data never leaves your device.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "drank · Track Domain Ratings in Your Browser",
    description: "Free DR tracker. ~45 popular sites + your own. No account, no server — everything lives in this tab.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "drank · Track Domain Ratings in Your Browser",
    description: "Free DR tracker. ~45 popular sites + your own. No account, no server — everything lives in this tab.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
