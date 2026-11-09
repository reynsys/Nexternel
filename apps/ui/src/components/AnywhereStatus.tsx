import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { BrandMark } from "./BrandMark";
import { api, type AnywhereView } from "../api";
import { hasPermission, type RolePermissions } from "../lib/permissions";
import { LIGHT_COLOUR } from "../pages/admin/settings/AnywhereCard";

const SHORT: Record<AnywhereView["light"], string> = {
  green: "Working",
  orange: "Connecting…",
  red: "Needs a look",
  off: "Off",
};

/**
 * Nexternel Anywhere in the menu: its light (the same as in Settings → System) and a short word, so
 * a problem is seen without opening Settings. Not a button: its settings are in Settings → System.
 * Only for people who may see system settings, and only once Anywhere has been set up.
 */
export function AnywhereStatus({ permissions, isAdmin }: { permissions?: RolePermissions | null; isAdmin: boolean; onNavigate?: () => void }) {
  const allowed = hasPermission(permissions ?? null, "viewSystem", isAdmin);
  const [view, setView] = useState<AnywhereView | null>(null);
  useEffect(() => {
    if (!allowed) return;
    let gone = false;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      void api
        .anywhere()
        .then((v) => !gone && setView(v))
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      gone = true;
      clearInterval(t);
    };
  }, [allowed]);
  if (!allowed || !view?.setUp) return null;
  // A plain line (not a button): the logo, "Anywhere", its light and a short word; the full story is
  // on its pointer label and in Settings → System.
  return (
    <Box
      role="status"
      title={view.text}
      sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.5, py: 0.5, minWidth: 0 }}
    >
      <BrandMark size={20} />
      <Typography component="span" variant="body2" sx={{ fontWeight: "fontWeightBold", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        Anywhere
      </Typography>
      <Box component="span" aria-hidden sx={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, bgcolor: LIGHT_COLOUR[view.light] }} />
      <Typography component="span" variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        {SHORT[view.light]}
      </Typography>
    </Box>
  );
}
