import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Foundry | SaaS Fleet Standard",
  description: "Standardize your entire project fleet with the Open Source Foundry.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-black text-white selection:bg-blue-500/30">
        {children}
      </body>
    </html>
  );
}
