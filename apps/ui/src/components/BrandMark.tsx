import { useId } from "react";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";

/*
 * The Nexternel logo: a hexagon planet (the Reynsys hexagon, its core with an N) with a tilted ring,
 * thick in front and thinning to a hairline where it goes behind. Drawn on a 64×64 grid.
 * The same drawing is in public/favicon.svg and the app icons (fixed colours there).
 */
const RING =
  "M1 32A31 10.5 0 1 0 63 32A31 10.5 0 1 0 1 32Z M2.2 29.6A29.8 7.8 0 1 0 61.8 29.6A29.8 7.8 0 1 0 2.2 29.6Z";
const OUTER = "32,15.5 46.29,23.75 46.29,40.25 32,48.5 17.71,40.25 17.71,23.75";
/** The planet's body: the ring's back half is hidden inside it. */
const BODY = "32,11.8 49.49,21.9 49.49,42.1 32,52.2 14.51,42.1 14.51,21.9";
const CORE = "32,23 39.79,27.5 39.79,36.5 32,41 24.21,36.5 24.21,27.5";
const N = "M29.1 35.44V28.56L34.9 35.44V28.56";

/**
 * The Nexternel logo at the top of the menu, the phone bar and the sign-in page. The ring and core
 * take the Look's main colour, the outer hexagon its quiet text colour, so it suits every Look.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  const t = useTheme();
  // Two logos on one page need their own mask names (and no ":" in a url(#…) reference).
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const main = t.palette.primary.main;
  const quiet = t.palette.text.secondary;
  return (
    <Box component="svg" viewBox="0 0 64 64" width={size} height={size} aria-hidden sx={{ flexShrink: 0, display: "block" }}>
      <defs>
        <mask id={`nx-front-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect width="64" height="64" fill="#fff" />
          <g transform="rotate(-20 32 32)">
            {/* Where the ring passes in front, a thin gap in the hexagons behind it. */}
            <path d={RING} fill="#000" fillRule="evenodd" stroke="#000" strokeWidth="3.2" />
            <rect x="-10" y="-10" width="84" height="41.99" fill="#fff" />
          </g>
          <path d={N} fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </mask>
        <mask id={`nx-back-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect width="64" height="64" fill="#fff" />
          <polygon points={BODY} fill="#000" stroke="#000" strokeWidth="1" strokeLinejoin="round" />
          <g transform="rotate(-20 32 32)">
            <rect x="-10" y="32" width="84" height="42" fill="#fff" />
          </g>
        </mask>
      </defs>
      <g mask={`url(#nx-front-${id})`}>
        <polygon points={OUTER} fill="none" stroke={quiet} strokeWidth="4.2" strokeLinejoin="round" />
        <polygon points={CORE} fill={main} />
      </g>
      <g mask={`url(#nx-back-${id})`}>
        <g transform="rotate(-20 32 32)">
          <path d={RING} fill={main} fillRule="evenodd" />
        </g>
      </g>
    </Box>
  );
}
