/**
 * Vercel Edge Function — OG Image Generator
 * Route: /api/og
 *
 * Generates a 1200x630 PNG OG image for Sidekick using @vercel/og (Satori).
 * Dark background (#141210), Space Grotesk bold, acid yellow (#d4f53c).
 */

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default function handler(req) {
  try {
    const { searchParams } = new URL(req.url);

    // Optional query params for dynamic variants
    const title = searchParams.get('title') || 'Your marketing sidekick, via text.';
    const sub = searchParams.get('sub') || 'No app. No dashboard. No login. Ever.';

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            background: '#141210',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '64px 72px',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle grid texture overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage:
                'linear-gradient(rgba(212,245,60,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(212,245,60,0.03) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              display: 'flex',
            }}
          />

          {/* Top: Logo + SMS chip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Logo */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0px',
              }}
            >
              <span
                style={{
                  fontFamily: '"Space Mono", monospace',
                  fontWeight: 700,
                  fontSize: '28px',
                  color: '#f5f0e8',
                  letterSpacing: '-0.02em',
                }}
              >
                sidekick
              </span>
              <span
                style={{
                  fontFamily: '"Space Mono", monospace',
                  fontWeight: 700,
                  fontSize: '28px',
                  color: '#d4f53c',
                }}
              >
                _
              </span>
            </div>

            {/* SMS bubble chip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(212,245,60,0.08)',
                border: '1px solid rgba(212,245,60,0.2)',
                borderRadius: '6px',
                padding: '10px 20px',
              }}
            >
              {/* Chat icon (inline SVG as img-like element) */}
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                style={{ display: 'flex' }}
              >
                <path
                  d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z"
                  fill="#d4f53c"
                />
                <rect x="7" y="8" width="10" height="2" rx="1" fill="#d4f53c" />
                <rect x="7" y="12" width="6" height="2" rx="1" fill="#d4f53c" />
              </svg>
              <span
                style={{
                  fontFamily: '"Space Mono", monospace',
                  fontSize: '14px',
                  color: '#d4f53c',
                  letterSpacing: '0.04em',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                AI via SMS
              </span>
            </div>
          </div>

          {/* Middle: Main headline */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div
              style={{
                fontSize: '68px',
                fontWeight: 700,
                color: '#f5f0e8',
                lineHeight: 1.05,
                letterSpacing: '-0.04em',
                maxWidth: '860px',
              }}
            >
              {title.includes('sidekick') ? (
                <span>
                  {title.split('sidekick').map((part, i, arr) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span style={{ color: '#d4f53c' }}>sidekick</span>
                      )}
                    </span>
                  ))}
                </span>
              ) : (
                title
              )}
            </div>
            <div
              style={{
                fontSize: '26px',
                color: '#7d7060',
                letterSpacing: '-0.01em',
                fontWeight: 400,
              }}
            >
              {sub}
            </div>
          </div>

          {/* Bottom: Feature pills */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
            }}
          >
            {['Social posts', 'Review replies', 'Scheduling', 'Analytics'].map((label) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#1c1917',
                  border: '1px solid #332f29',
                  borderRadius: '4px',
                  padding: '8px 16px',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    color: '#d4f53c',
                    fontWeight: 700,
                    fontFamily: '"Space Mono", monospace',
                  }}
                >
                  &#10003;
                </span>
                <span
                  style={{
                    fontSize: '15px',
                    color: '#b0a898',
                    fontWeight: 500,
                  }}
                >
                  {label}
                </span>
              </div>
            ))}

            {/* Spacer + CTA */}
            <div style={{ flex: 1, display: 'flex' }} />
            <div
              style={{
                background: '#d4f53c',
                borderRadius: '4px',
                padding: '10px 24px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#141210',
                  letterSpacing: '0.01em',
                }}
              >
                Join the waitlist
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        // Note: @vercel/og loads fonts via fetch at edge runtime.
        // In production, fonts must be fetched or embedded.
        // For self-hosted fallback, system-ui is used if Space Grotesk fails to load.
      }
    );
  } catch (err) {
    console.error('[og] Error generating image:', err);
    return new Response('Failed to generate OG image', { status: 500 });
  }
}
