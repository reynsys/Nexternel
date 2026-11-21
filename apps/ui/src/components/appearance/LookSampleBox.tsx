import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import type { ThemePrefs } from "../../skins/themePrefs";
import { LookLayer } from "../../skins/SkinProvider";
import { getSkin } from "../../skins/registry";
import { LookSample, NO_CONTROLS, type LookSampleShow } from "./LookSample";

/**
 * A sample drawn straight in the page in some Appearance settings (a Look tile, a button style tile):
 * the real parts in a Look box of their own (LookLayer box), so no second copy of Nexternel is started
 * for it. `drawnWidth`: the sample is laid out this wide, then shrunk to fit the tile; without it the
 * sample keeps its own size (one button).
 */
export function LookSampleBox({
  prefs,
  skinId,
  show,
  drawnWidth,
  background = true,
}: {
  prefs: ThemePrefs;
  skinId: string;
  show: LookSampleShow;
  drawnWidth?: number;
  /** Show the Appearance's background behind the sample. */
  background?: boolean;
}) {
  const skin = useMemo(() => getSkin(skinId), [skinId]);
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(drawnWidth ?? 0);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    if (!drawnWidth) return undefined;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return undefined;
    // Sizes without the shrinking (offset sizes are not scaled).
    const measure = () => {
      setAvail(Math.max(60, outer.offsetWidth));
      setHeight(inner.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [drawnWidth]);

  const sample = (
    <LookLayer box skin={skin} themePrefs={prefs} controls={NO_CONTROLS} background={background}>
      <LookSample show={show} />
    </LookLayer>
  );
  if (!drawnWidth) return sample;

  const scale = Math.min(1, avail / drawnWidth);
  return (
    <Box ref={outerRef} sx={{ width: "100%", height: height * scale, overflow: "hidden" }}>
      <Box ref={innerRef} sx={{ width: drawnWidth, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {sample}
      </Box>
    </Box>
  );
}
