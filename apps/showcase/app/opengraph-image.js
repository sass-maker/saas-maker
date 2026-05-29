import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';
export const alt = 'Foundry — a personal fleet by Sarthak Agrawal';
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
          justifyContent: 'space-between',
          padding: '72px 80px',
          background:
            'radial-gradient(circle at 15% 20%, rgba(224,123,58,0.28) 0%, transparent 55%), radial-gradient(circle at 90% 90%, rgba(111,151,184,0.18) 0%, transparent 55%), #0b0d12',
          color: '#ede8dd',
          fontFamily: 'serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '22px', color: '#b9b3a6' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'linear-gradient(145deg, #f4965a, #e07b3a 60%, #b35a1f)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontStyle: 'italic',
              fontWeight: 600,
              color: '#1a0f06',
            }}
          >
            F
          </div>
          <span style={{ fontFamily: 'serif', fontStyle: 'italic', fontSize: '26px', color: '#ede8dd' }}>Foundry</span>
          <span style={{ color: '#4d4a44' }}>·</span>
          <span style={{ fontFamily: 'sans-serif', fontSize: '18px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Vol. 01</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: '82px',
              fontWeight: 600,
              lineHeight: 1.02,
              letterSpacing: '-0.035em',
              maxWidth: '1000px',
              fontFamily: 'serif',
              fontStyle: 'italic',
              color: '#ede8dd',
              display: 'flex',
            }}
          >
            A small, working fleet.
          </div>
          <div
            style={{
              fontSize: '36px',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              marginTop: '12px',
              fontFamily: 'sans-serif',
              color: '#b9b3a6',
              display: 'flex',
            }}
          >
            Twenty products. One builder. One open-source backend.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '18px',
            color: '#7a7568',
            fontFamily: 'sans-serif',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          <span>sarthakagrawal927 · MIT · MMXXIV →</span>
          <span style={{ color: '#e07b3a' }}>sassmaker.com</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
