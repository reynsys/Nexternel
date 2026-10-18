import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import type { SxProps, Theme } from "@mui/material/styles";
import { useLook } from "./useLook";
import type { DecorSlot } from "./types";

/**
 * Draws the chosen Look's decoration for one place, filling its parent (which must be
 * position: relative). Core space rule: decorations stay inside the box they decorate; the box
 * reserves room for them with the Look's space roles. Marked "nx-anim" so the Animations
 * setting (on/off, per panel too) applies to everything moving in it.
 */
export function LookDecor({ slot, place }: { slot: DecorSlot; place?: string }) {
  const look = useLook();
  const Decor = look.decor?.[slot] ?? (slot === "panel" ? look.PanelFrame : undefined);
  if (!Decor) return null;
  return (
    <Box className="nx-anim" aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      <Decor place={place} />
    </Box>
  );
}

/** True when the Look draws its own decoration for this place. */
export function useHasDecor(slot: DecorSlot): boolean {
  const look = useLook();
  return Boolean(look.decor?.[slot] ?? (slot === "panel" ? look.PanelFrame : undefined));
}

/**
 * A divider in the side menu: the plain line in Standard, or the Look's own divider drawing in
 * the room the Look reserves for it (dividerSpace).
 */
export function RoleDivider({ place, sx }: { place: "top" | "bottom"; sx?: SxProps<Theme> }) {
  const decorated = useHasDecor("menuDivider");
  if (!decorated) return <Divider sx={sx} />;
  return (
    <Box sx={[(t) => ({ position: "relative", height: t.nx.dividerSpace, flexShrink: 0 }), ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      <LookDecor slot="menuDivider" place={place} />
    </Box>
  );
}
