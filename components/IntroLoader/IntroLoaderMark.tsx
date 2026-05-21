"use client";

/** Glass dual-lobe mark — white & blue (landing theme). */
export function IntroLoaderMark() {
  return (
    <div className="intro-mark" aria-hidden>
      <svg
        aria-hidden
        className="intro-mark__svg"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Impact Logistics mark</title>
        <defs>
          <linearGradient id="intro-orb-a" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#007bff" />
          </linearGradient>
          <linearGradient id="intro-orb-b" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#eff6ff" />
            <stop offset="45%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#0069d9" />
          </linearGradient>
          <linearGradient id="intro-edge" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#007bff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#007bff" stopOpacity="0" />
          </linearGradient>
          <filter
            id="intro-neon-glow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0.48
                      0 0 0 0 1
                      0 0 0 0.4 0"
            />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#intro-neon-glow)">
          <path
            d="M60 12c21 0 36 13 42 32 5 16-1 33-16 41-11 6-24 4-31-6-8-11-6-25 4-32 7-5 16-7 25-5 3-13 12-23 26-30-9-6-19-10-32-10z"
            fill="url(#intro-orb-a)"
            fillOpacity="0.9"
          />
          <path
            d="M60 108c-21 0-36-13-42-32-5-16 1-33 16-41 11-6 24-4 31 6 8 11 6 25-4 32-7 5-16 7-25 5-3 13-12 23-26 30 9 6 19 10 32 10z"
            fill="url(#intro-orb-b)"
            fillOpacity="0.86"
          />
        </g>

        <path
          d="M60 36c9 0 16 5 19 14 2 7 0 15-7 19-6 4-14 5-20 1-7-5-9-14-4-20 4-5 10-9 17-9 2-7 7-13 15-15-3-2-7-4-12-4-11 0-20 7-24 18-3 9 0 19 7 25 6 5 15 7 23 3"
          stroke="url(#intro-edge)"
          strokeWidth="1.25"
          strokeLinecap="round"
          fill="none"
          className="intro-mark__highlight"
        />
      </svg>
    </div>
  );
}
