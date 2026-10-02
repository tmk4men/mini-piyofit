import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconBowl = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 12h17a8.5 7 0 0 1-17 0Z" />
    <path d="M6.5 12c.6-2.6 2.8-4 5.5-4s4.9 1.4 5.5 4" />
    <path d="M14 3.5 19.5 8M16.5 3 21 7" />
    <path d="M9 20.5h6" />
  </Svg>
);

export const IconDumbbell = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="8.5" width="3.5" height="7" rx="1.2" />
    <rect x="18" y="8.5" width="3.5" height="7" rx="1.2" />
    <rect x="6" y="6.5" width="2.8" height="11" rx="1.2" />
    <rect x="15.2" y="6.5" width="2.8" height="11" rx="1.2" />
    <path d="M8.8 12h6.4" />
  </Svg>
);

export const IconSparkle = (p: P) => (
  <Svg {...p}>
    <path d="M10 3.5c.5 3.8 2.2 5.5 6 6-3.8.5-5.5 2.2-6 6-.5-3.8-2.2-5.5-6-6 3.8-.5 5.5-2.2 6-6Z" />
    <path d="M18 14.5c.25 1.7 1 2.5 2.7 2.7-1.7.25-2.45 1-2.7 2.7-.25-1.7-1-2.45-2.7-2.7 1.7-.2 2.45-1 2.7-2.7Z" />
  </Svg>
);

export const IconMenu = (p: P) => (
  <Svg {...p}>
    <path d="M5 7h14M5 12h14M5 17h14" />
  </Svg>
);

export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconHeart = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Svg {...p} strokeWidth={2}>
    <path
      d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.3C19.5 15.4 12 20 12 20Z"
      fill={filled ? "currentColor" : "none"}
    />
  </Svg>
);

export const IconMusic = (p: P) => (
  <Svg {...p}>
    <path d="M9 17.5V5.5l10-2v12" />
    <circle cx="6.5" cy="17.5" r="2.5" />
    <circle cx="16.5" cy="15.5" r="2.5" />
  </Svg>
);

export const IconSpeaker = (p: P) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Svg>
);

export const IconBook = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5c2.8-1 5.5-1 8 .8 2.5-1.8 5.2-1.8 8-.8v13c-2.8-1-5.5-1-8 .8-2.5-1.8-5.2-1.8-8-.8Z" />
    <path d="M12 6.3v13" />
  </Svg>
);

export const IconQuestion = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.6 2.6 0 0 1 5 .8c0 1.8-2.5 2.2-2.5 3.9" />
    <path d="M12 17.2h.01" />
  </Svg>
);

export const IconRestart = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 4.5v3.5H8" />
  </Svg>
);

export const IconCamera = (p: P) => (
  <Svg {...p}>
    <path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4Z" />
    <circle cx="12" cy="13.2" r="3.3" />
  </Svg>
);

export const IconHand = (p: P) => (
  <Svg {...p}>
    <path d="M8.5 12V5.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M11.5 10.5V4.2a1.5 1.5 0 0 1 3 0v6.3" />
    <path d="M14.5 10.5V6a1.5 1.5 0 0 1 3 0v7.5a6.5 6.5 0 0 1-6.5 6.5c-2.4 0-3.8-.9-5.2-2.6L3.6 14a1.5 1.5 0 0 1 2.3-1.9L8.5 15" />
  </Svg>
);

export const IconSquat = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="4.5" r="2" />
    <path d="M12 7v5.5l-4 2.5 1.5 5M12 12.5l4 2.5-1.5 5M7 9.5h10" />
  </Svg>
);

export const IconPushup = (p: P) => (
  <Svg {...p}>
    <circle cx="4.5" cy="9" r="2" />
    <path d="M6.5 10 20.5 13.5M8 10.5V16M20.5 13.5V16M2.5 17h19" />
  </Svg>
);

export const IconCoin = (p: P) => (
  <Svg {...p} strokeWidth={2}>
    <circle cx="12" cy="12" r="8.5" fill="#ffcd57" stroke="#c98a1c" />
    <circle cx="12" cy="12" r="5.5" stroke="#c98a1c" strokeWidth={1.4} />
    <path d="M12 9.2v5.6" stroke="#c98a1c" />
  </Svg>
);

export const IconBag = (p: P) => (
  <Svg {...p}>
    <path d="M5 8.5h14l-1.2 11H6.2Z" />
    <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
  </Svg>
);

export const IconTrip = (p: P) => (
  <Svg {...p}>
    <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.4" />
  </Svg>
);

export const IconOnigiri = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5c-2 0-8.5 10-8.5 13.3 0 2.2 1.6 3.2 3.4 3.2h10.2c1.8 0 3.4-1 3.4-3.2C20.5 13.5 14 3.5 12 3.5Z" />
    <path d="M8 14.5h8V20H8Z" fill="currentColor" />
  </Svg>
);

export const IconBento = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M12 6v13M3 12.5h9" />
    <circle cx="16.5" cy="10.5" r="1.6" />
    <path d="M15 15.5h3" />
  </Svg>
);

export const IconCake = (p: P) => (
  <Svg {...p}>
    <path d="M4 12.5h16V20H4Z" />
    <path d="M4 15.5c2 1.3 4 1.3 6 0s4-1.3 6 0 3 1 4 .6" />
    <path d="M12 12.5V8.5" />
    <path d="M12 5c.9.9.9 2 0 2.6-.9-.6-.9-1.7 0-2.6Z" fill="currentColor" />
  </Svg>
);

export const IconRing = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="14.5" r="5.5" />
    <path d="M9.5 6.5 12 3.5l2.5 3-2.5 3Z" fill="currentColor" />
  </Svg>
);
