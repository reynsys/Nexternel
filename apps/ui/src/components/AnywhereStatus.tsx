import { useEffect, useState } from "react";
import { Box, Tooltip, Typography, useTheme } from "@mui/material";
import { BrandMark } from "./BrandMark";
import { api, type AnywhereView } from "../api";
import { hasPermission, type RolePermissions } from "../lib/permissions";

const SHORT: Record<AnywhereView["light"], string> = {
  green: "Connected",
  orange: "Connecting…",
  red: "Not connected",
  off: "Off",
};

/**
 * Nexternel Anywhere in the menu: the logo and name with a rounded square light (green, orange, red,
 * grey) on the first line, and the state in a word under the name, always, so it is clear without
 * telling colours apart. The square's tooltip gives the exact reason. Not a button: its settings are in
 * Settings → System. (The home the app opens is on App settings.)
 * Only for people who may see system settings, and only once Anywhere has been set up.
 */
export function AnywhereStatus({
  permissions,
  isAdmin,
}: {
  permissions?: RolePermissions | null;
  isAdmin: boolean;
}) {
  const theme = useTheme();
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
  const setUp = allowed && Boolean(view?.setUp);
  if (!setUp || !view) return null;
  const light = view.light;
  const ink = { green: theme.palette.success.main, orange: theme.palette.warning.main, red: theme.palette.error.main, off: theme.palette.text.disabled }[light];
  const word = SHORT[light];
  return (
    <Box role="status" aria-label={`Nexternel Anywhere: ${word}`} sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
      <BrandMark size={28} anywhere />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography component="div" variant="body2" noWrap sx={{ fontWeight: "fontWeightBold", lineHeight: 1.3 }}>
          Nexternel Anywhere
        </Typography>
        <Typography component="div" variant="caption" noWrap sx={{ color: ink, fontWeight: "fontWeightBold" }}>
          {word}
        </Typography>
      </Box>
      <Tooltip title={view.text}>
        <Box component="span" sx={(t) => ({ width: 14, height: 14, borderRadius: `${t.nx.radiusUnit * 0.5}px`, bgcolor: ink, boxShadow: `0 0 6px ${ink}`, flexShrink: 0, alignSelf: "flex-start", mt: 0.5 })} />
      </Tooltip>
    </Box>
  );
}
