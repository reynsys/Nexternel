import { useMemo, type ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import type { ThemePrefs } from "../../skins/themePrefs";
import { resolveLook } from "../../skins/looks/registry";
import { fontFamilyFor } from "../../skins/looks/resolve";
import { gradientCss } from "../../skins/gradientPalettes";
import { isMineBackground, mineBackground, schemeForPrefs } from "../../skins/appearance-scheme";

/**
 * A small dashboard drawn with the settings being chosen (not necessarily the ones in use, e.g. when an
 * admin sets another person's look): side menu, top bar, a section with panels, big values, a switch,
 * a chart, the dock and a side panel (no pretend buttons: nothing in it can be pressed) — and whether everything is readable.
 */
export function AppearancePreview({ prefs, deviceDark = true }: { prefs: ThemePrefs; deviceDark?: boolean }) {
  const look = resolveLook(prefs.lookId);
  const mode = look.forceMode ?? (prefs.autoMode ? (deviceDark ? "dark" : "light") : prefs.mode);
  const scheme = useMemo(() => schemeForPrefs({ ...prefs, mode }, mode, Boolean(look.frosted)), [prefs, mode, look]);
  const r = scheme.roles;
  const page = isMineBackground(prefs.gradientId)
    ? mineBackground(scheme, prefs.gradientId!).css
    : (gradientCss(prefs.gradientId, mode) ?? r.surfaceSolid.background);
  const glass = r.surfaces === "glass";
  const font = fontFamilyFor(look, prefs.lookFont);
  const blur = glass ? "blur(12px)" : "none";
  const edge = `1px solid ${r.line.edge}`;
  const frame = { bgcolor: r.surface.frame, backdropFilter: blur, border: edge };
  const out = { border: `1px solid ${r.line.control}`, color: r.main.text, bgcolor: "transparent" };
  const solid = { bgcolor: r.main.solid, color: r.main.ink, border: `1px solid ${r.main.solid}` };
  const btn = { borderRadius: 1, px: 1, py: 0.25, fontSize: "0.7rem", fontWeight: 500, whiteSpace: "nowrap" as const };
  const allReadable = scheme.audit.every((a) => a.pass);

  const panel = (title: string, area: string, body: ReactNode, light?: string) => (
    <Box sx={{ bgcolor: r.surface.panel, backdropFilter: blur, border: edge, borderRadius: 1.75, display: "flex", flexDirection: "column", minHeight: 108, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1, pt: 0.75 }}>
        <Box component="span" sx={{ color: r.text.quiet, fontSize: "0.6rem", letterSpacing: "-2px" }}>⋮⋮</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontFamily: font, fontSize: "0.72rem", fontWeight: 600, color: r.text.main, lineHeight: 1.2 }}>{title}</Typography>
          <Typography noWrap sx={{ fontFamily: font, fontSize: "0.6rem", color: r.text.quiet, lineHeight: 1.2 }}>{area}</Typography>
        </Box>
        {light ? <Box sx={{ width: 18, height: 7, borderRadius: 1, bgcolor: light }} /> : null}
      </Box>
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", px: 1, pb: 1 }}>{body}</Box>
    </Box>
  );

  return (
    <Box>
      <Box
        aria-label="Preview of these settings"
        role="img"
        sx={{
          backgroundImage: page.includes("gradient") ? page : undefined,
          bgcolor: page.includes("gradient") ? r.surfaceSolid.background : page,
          backgroundSize: "100% 100%",
          border: edge,
          borderRadius: 2,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "120px 1fr 150px" },
          minHeight: 300,
          fontFamily: font,
          color: r.text.main,
        }}
      >
        <Box sx={{ ...frame, border: 0, borderRight: edge, p: 1, display: { xs: "none", sm: "flex" }, flexDirection: "column", gap: 0.75 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, pb: 1, mb: 0.5, borderBottom: `1px solid ${r.line.divider}` }}>
            <Box sx={{ width: 14, height: 14, borderRadius: "50%", background: `linear-gradient(135deg, ${r.main.solid}, ${r.second.solid})` }} />
            <Typography sx={{ fontFamily: font, fontSize: "0.75rem", fontWeight: 700, color: r.text.main }}>Nexternel</Typography>
          </Box>
          {["Dashboards", "Areas", "Devices", "Settings"].map((n, i) => (
            <Box key={n} sx={{ ...btn, ...(i === 0 ? solid : out), py: 0.5, fontFamily: font }}>{n}</Box>
          ))}
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Box sx={{ ...frame, border: 0, borderBottom: edge, display: "flex", alignItems: "center", gap: 0.75, px: 1.25, py: 0.75 }}>
            <Typography sx={{ fontFamily: font, fontSize: "0.85rem", fontWeight: 600, color: r.text.main, flex: 1 }}>Living Room</Typography>
          </Box>
          <Box sx={{ p: 1.25, flex: 1 }}>
            <Box sx={{ ...frame, borderRadius: 2, p: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
                <Typography sx={{ fontFamily: font, fontSize: "0.8rem", fontWeight: 600, color: r.text.main }}>Climate</Typography>
                <Typography sx={{ fontFamily: font, fontSize: "0.6rem", color: r.text.quiet, flex: 1 }}>4 panels</Typography>
                <Box sx={{ ...btn, ...out, px: 0.75, fontFamily: font }}>⌃</Box>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 0.75 }}>
                {panel("Temperature", "Living Room", <Typography sx={{ fontFamily: font, fontSize: "1.35rem", fontWeight: 650, color: r.value }}>21.4<Box component="span" sx={{ fontSize: "0.6em", color: r.text.quiet }}> °C</Box></Typography>, r.status.ok.solid)}
                {panel("Humidity", "Living Room", <Typography sx={{ fontFamily: font, fontSize: "1.35rem", fontWeight: 650, color: r.value }}>63<Box component="span" sx={{ fontSize: "0.6em", color: r.text.quiet }}> %</Box></Typography>, r.status.watch.solid)}
                {panel("Lights", "Living Room", (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography sx={{ fontFamily: font, fontWeight: 650, color: r.main.text }}>On</Typography>
                    <Box sx={{ width: 30, height: 16, borderRadius: 1, bgcolor: r.main.solid, position: "relative" }}>
                      <Box sx={{ position: "absolute", right: 2, top: 2, width: 12, height: 12, borderRadius: "50%", bgcolor: r.main.ink }} />
                    </Box>
                  </Box>
                ))}
                {panel("Energy", "House", (
                  <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.4, height: 48, width: "100%" }}>
                    {[60, 35, 80, 45, 70, 30].map((h, i) => <Box key={i} sx={{ flex: 1, height: `${h}%`, bgcolor: r.series[i % 3], borderRadius: 0.5 }} />)}
                  </Box>
                ), r.status.alert.solid)}
              </Box>
            </Box>
            <Box sx={{ ...frame, borderRadius: 2, display: "flex", gap: 0.5, p: 0.75, width: "fit-content", mx: "auto", mt: 1.25 }}>
              {["⌂", "⚡", "❄", "⚙"].map((x, i) => <Box key={x} sx={{ ...btn, ...(i === 0 ? solid : out), px: 0.9 }}>{x}</Box>)}
            </Box>
          </Box>
        </Box>
        <Box sx={{ bgcolor: r.surface.popup, backdropFilter: blur, borderLeft: edge, p: 1, display: { xs: "none", sm: "flex" }, flexDirection: "column", gap: 0.75 }}>
          <Typography sx={{ fontFamily: font, fontSize: "0.8rem", fontWeight: 600, color: r.text.main, pb: 0.75, borderBottom: `1px solid ${r.line.divider}` }}>Section settings</Typography>
          <Typography sx={{ fontFamily: font, fontSize: "0.6rem", color: r.text.quiet }}>Name</Typography>
          <Box sx={{ border: `1px solid ${r.line.control}`, bgcolor: r.surface.control, borderRadius: 1, px: 0.75, py: 0.4, fontSize: "0.7rem", fontFamily: font }}>Climate</Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
            {(["main", "second", "third"] as const).map((k) => (
              <Box key={k} sx={{ px: 0.75, py: 0.2, borderRadius: 2, bgcolor: r[k].soft, color: r[k].text, fontSize: "0.6rem", fontWeight: 600, fontFamily: font }}>
                {k === "main" ? "Main" : k === "second" ? "Second" : "Third"}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: allReadable ? "success.main" : "warning.main" }}>
        {allReadable
          ? `✓ Every text and control is readable (${scheme.audit.length} checks).`
          : "Some text may be hard to read with these settings."}
      </Typography>
    </Box>
  );
}
