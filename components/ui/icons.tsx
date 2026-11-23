/** Custom 1.75px-stroke, square-cap icons. No icon library. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "square",
  strokeLinejoin: "miter",
  "aria-hidden": true,
  focusable: false,
});

export const IconArrow = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);
export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);
export const IconCross = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconLock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 11h14v10H5zM8 11V7a4 4 0 018 0v4" />
  </svg>
);
export const IconPin = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 21s-6-6.2-6-11a6 6 0 0112 0c0 4.8-6 11-6 11z" />
    <path d="M12 8v4" />
  </svg>
);
export const IconEye = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z" />
    <path d="M12 9.5v5M9.5 12h5" />
  </svg>
);
export const IconCamera = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M3 7h4l2-3h6l2 3h4v13H3z" />
    <path d="M12 10a3.5 3.5 0 110 7 3.5 3.5 0 010-7z" />
  </svg>
);
export const IconClock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v5l3 2" />
  </svg>
);

/** Shared SVG filter that roughens stamp edges so they look inked. Render once per page. */
export function RoughFilter() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable={false}>
      <filter id="rough">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" />
      </filter>
    </svg>
  );
}
