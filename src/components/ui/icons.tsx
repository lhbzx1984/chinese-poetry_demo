import type { SVGProps } from "react";
const paths = {
  map: "M3 5 9 3l6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16",
  library: "M4 3h5v18H4V3Zm7 1h4v17h-4V4Zm5 2 4-1 3 15-4 1-3-15Z",
  shuffle:
    "M3 5h3c5 0 7 14 12 14h3m-4-4 4 4-4 3M3 19h3c2 0 4-3 6-7m2-5c1-1 2-2 4-2h3m-4-3 4 3-4 4",
  play: "m8 4 12 8-12 8V4Z",
  pause: "M7 4h3v16H7V4Zm7 0h3v16h-3V4Z",
  speaker: "m4 9 4 0 5-5v16l-5-5H4V9Zm12-2c3 3 3 7 0 10m3-13c5 5 5 11 0 16",
  muted: "m4 9 4 0 5-5v16l-5-5H4V9Zm12 0 6 6m0-6-6 6",
  close: "m6 6 12 12M18 6 6 18",
  next: "m9 5 7 7-7 7",
  previous: "m15 5-7 7 7 7",
  film: "M3 3h18v18H3V3Zm4 0v18m10-18v18M3 8h4m10 0h4M3 16h4m10 0h4",
  vertical: "M5 3v18m6-18v10m6-10v10m-5 5h9m-3-3 3 3-3 3",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-8 0v6",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  mountains: "m2 19 7-13 5 8 3-5 5 10H2Zm12-14a2 2 0 1 0 4 0 2 2 0 0 0-4 0",
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
