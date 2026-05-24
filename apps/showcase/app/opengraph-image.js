import { ImageResponse } from 'next/og';

// Generated share-card for link previews (Open Graph + Twitter).
// `force-static` so it pre-renders to a PNG at build time (output: 'export').
export const dynamic = 'force-static';
export const alt = 'SaaS Maker — Everything you need to launch & grow your SaaS';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #0b1220 0%, #0a0e1a 100%)',
          color: '#e8ecf4',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '28px',
            fontWeight: 700,
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 800,
              color: 'white',
            }}
          >
            F
          </div>
          SaaS Maker
        </div>
        <div
          style={{
            marginTop: '36px',
            fontSize: '70px',
            fontWeight: 800,
            lineHeight: 1.08,
            maxWidth: '960px',
          }}
        >
          Run every product from one operational cockpit.
        </div>
        <div
          style={{
            marginTop: '28px',
            fontSize: '30px',
            color: '#9aa6bd',
            maxWidth: '900px',
          }}
        >
          Project registry, feedback, changelog, testimonials, tasks, and
          tasks — one API-first backend for your whole fleet.
        </div>
      </div>
    ),
    { ...size },
  );
}
