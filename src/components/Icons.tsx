import React from 'react';

export const PlayIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <polygon points="6,4 20,12 6,20" />
  </svg>
);

export const PauseIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

export const UndoIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 14H4v-5" />
    <path d="M20 20a9 9 0 0 0-16-6" />
  </svg>
);

export const RedoIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 14h5v-5" />
    <path d="M4 20a9 9 0 0 1 16-6" />
  </svg>
);

export const RestartIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M1 4v6h6" />
    <path d="M3.51 9a9 9 0 1 1 2.13 5.88" />
  </svg>
);

export const RobotIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="8" width="18" height="8" rx="2" />
    <rect x="7" y="16" width="10" height="4" rx="1" />
    <circle cx="7" cy="12" r="1.5" fill="currentColor" />
    <circle cx="17" cy="12" r="1.5" fill="currentColor" />
    <path d="M12 8V4" />
    <path d="M8 4h8" />
  </svg>
);

export const StarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <polygon points="12,2 15,9 22,9.2 17,14 18.5,21 12,17.5 5.5,21 7,14 2,9.2 9,9" />
  </svg>
);
