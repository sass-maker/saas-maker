import { SaasMakerAnalytics } from './SaasMakerAnalytics';
import './globals.css';

export const metadata = {
  title: 'SaaS Maker — Everything you need to launch & grow your SaaS',
  description: 'Waitlist, testimonials, feedback, changelog, analytics and more — plug-and-play tools for every stage of your product.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SaasMakerAnalytics />
        {children}
      </body>
    </html>
  );
}
