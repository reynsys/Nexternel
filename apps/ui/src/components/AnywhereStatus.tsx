import { useEffect, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import { ICON_SIZE } from "../lib/appearance/type";
import { BrandMark } from "./BrandMark";
import { api, type AnywhereView } from "../api";
import { hasPermission, type RolePermissions } from "../lib/permissions";

const SHORT: Record<AnywhereView["light"], string> = {
  green: "Working",
  orange: "Connecting…",
  red: "Needs a look",
  off: "Off",
};

/**
 * Nexternel Anywhere in the menu: the logo in its light's colour (the same as in Settings → System) and
 * a short word, so a problem is seen without opening Settings. Not a button: its settings are in
 * Settings → System. With homeLine (Nexternel for Android) the home this phone opens is under it.
 * Only for people who may see system settings, and only once Anywhere has been set up.
 */
export function AnywhereStatus({ permissions, isAdmin, homeLine = false }: { permissions?: RolePermissions | null; isAdmin: boolean; onNavigate?: () => void; homeLine?: boolean }) {
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
  if (!setUp && !homeLine) return null;
  const light = view?.light ?? "off";
  const ink = { green: theme.palette.success.main, orange: theme.palette.warning.main, red: theme.palette.error.main, off: theme.palette.text.disabled }[light];
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, minWidth: 0 }}>
      {/* The logo is the light: one colour — green working, orange connecting, red needs a look,
          grey off — with the word beside it, so it is clear without telling colours apart. */}
      {setUp && view ? (
        <Box role="status" title={view.text} sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
          <BrandMark size={34} colour={ink} />
          <Box sx={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", columnGap: 1, minWidth: 0, flex: 1 }}>
            <Typography component="span" variant="body2" sx={{ fontWeight: "fontWeightBold", whiteSpace: "nowrap" }}>
              Nexternel Anywhere
            </Typography>
            <Typography component="span" variant="caption" sx={{ color: ink, fontWeight: "fontWeightBold", whiteSpace: "nowrap" }}>
              {SHORT[light]}
            </Typography>
          </Box>
        </Box>
      ) : null}
      {homeLine ? (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, minWidth: 0, pl: setUp ? 0.5 : 0 }}>
          <HomeOutlinedIcon aria-label="Home" sx={{ fontSize: ICON_SIZE.inline, color: "text.secondary", flexShrink: 0, mt: 0.25 }} />
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
            {window.location.host}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}
