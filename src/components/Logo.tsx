import React from 'react';

export const OpenClueLogo: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="OpenClue Logo"
  >
    <defs>
      <linearGradient id="oc_grad" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38BDF8" />
        <stop offset="1" stopColor="#6366F1" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#oc_grad)" fillOpacity="0.14" stroke="url(#oc_grad)" strokeWidth="1.75" />
    <circle cx="16" cy="16" r="6" stroke="url(#oc_grad)" strokeWidth="2.2" />
    <circle cx="16" cy="16" r="2.2" fill="#38BDF8" />
    <path d="M16 6V9M16 23V26M6 16H9M23 16H26" stroke="#38BDF8" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);
