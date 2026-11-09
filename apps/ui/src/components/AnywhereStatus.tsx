import { useEffect, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
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
 * a problem is seen without opening Settings. Pressing it opens the Nexternel Anywhere card.
 * Only for people who may see system settings, and only once Anywhere has been set up.
 */
export function AnywhereStatus({ permissions, isAdmin, onNavigate }: { permissions?: RolePermissions | null; isAdmin: boolean; onNavigate?: () => void }) {
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
  return (
    <Button
      fullWidth
      variant="outlined"
      component={RouterLink}
      to="/admin/settings/system#nexternel-anywhere"
      onClick={onNavigate}
      title={view.text}
      sx={{ justifyContent: "flex-start", gap: 1, textTransform: "none" }}
    >
      <Box component="span" aria-hidden sx={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, bgcolor: LIGHT_COLOUR[view.light] }} />
      <Box component="span" sx={{ flex: 1, minWidth: 0, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        Nexternel Anywhere
      </Box>
      <Typography component="span" variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        {SHORT[view.light]}
      </Typography>
    </Button>
  );
}
