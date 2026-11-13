import type { ReactNode } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { gradientCss } from "./gradientPalettes";
import { type ThemePrefs, withLook } from "./themePrefs";
import { resolveLook } from "./looks/registry";
import { isMineBackground, mineBackground, schemeForPrefs } from "./appearance-scheme";
import { choiceSx } from "./surfaceStyles";
import { CORE_FONTS } from "../lib/appearance/fonts";
import type { ThemePreset } from "../lib/appearance/presets";

/** A choice tile: a name and a line about it (Looks, effects, menus, ready-made themes…). */
export function ChoiceTile({ selected, onClick, title, text, children, sx, disabled }: { selected: boolean; onClick: () => void; title: ReactNode; text?: ReactNode; children?: ReactNode; sx?: object; disabled?: boolean }) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      sx={[
        { width: "100%", height: "100%", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", justifyItems: "start", alignContent: "start", textAlign: "left", gap: 0.25, px: 1.25, py: 1 },
        choiceSx(selected),
        disabled ? { opacity: 0.5 } : {},
        sx ?? {},
      ]}
    >
      {children}
      <Typography variant="body2" fontWeight="fontWeightBold">
        {title}
      </Typography>
      {text ? (
        <Typography variant="caption" color="text.secondary">
          {text}
        </Typography>
      ) : null}
    </ButtonBase>
  );
}

/** The person's theme with a ready-made theme picked: its style, light or dark, colours, background and font. */
export function prefsWithPreset(prefs: ThemePrefs, p: ThemePreset): ThemePrefs {
  return {
    ...withLook(prefs, resolveLook(p.lookId).id === p.lookId ? p.lookId : "standard"),
    mode: p.mode,
    autoMode: false,
    primary: p.primary,
    harmony: p.harmony,
    second: p.second,
    third: p.third,
    gradientId: p.gradientId,
    lookFont: p.font,
  };
}

/** True when these prefs are this ready-made theme (as picked, before any change of one's own). */
export function presetIsChosen(prefs: ThemePrefs, mode: "light" | "dark", p: ThemePreset): boolean {
  return prefs.primary.toUpperCase() === p.primary && (prefs.lookId ?? "standard") === p.lookId && mode === p.mode && (prefs.gradientId ?? "none") === p.gradientId;
}

/** A ready-made theme to pick: its name, its line, and a small picture of its colours (Appearance and setup). */
export function ThemePresetTile({ preset: p, prefs, selected, onPick }: { preset: ThemePreset; prefs: ThemePrefs; selected: boolean; onPick: () => void }) {
  const pPrefs: ThemePrefs = { ...prefs, lookId: p.lookId, mode: p.mode, autoMode: false, primary: p.primary, harmony: p.harmony, second: p.second, third: p.third, gradientId: p.gradientId };
  const s = schemeForPrefs(pPrefs, p.mode, Boolean(resolveLook(p.lookId).frosted));
  const bg = isMineBackground(p.gradientId) ? mineBackground(s, p.gradientId).css : (gradientCss(p.gradientId, p.mode) ?? s.roles.surfaceSolid.background);
  return (
    <ChoiceTile selected={selected} onClick={onPick} title={p.label} text={p.description}>
      <Box
        aria-hidden
        sx={{
          width: "100%",
          height: 52,
          mb: 0.75,
          borderRadius: 1,
          border: `1px solid ${s.roles.line.edge}`,
          backgroundImage: bg.includes("gradient") ? bg : undefined,
          bgcolor: bg.includes("gradient") ? s.roles.surfaceSolid.background : bg,
          display: "flex",
          alignItems: "flex-end",
          gap: 0.5,
          p: 0.75,
        }}
      >
        {[s.roles.main.solid, s.roles.second.solid, s.roles.third.solid].map((c) => (
          <Box key={c} sx={{ width: 16, height: 16, borderRadius: "50%", bgcolor: c, border: `1px solid ${s.roles.line.edge}` }} />
        ))}
        <Typography variant="subtitle2" sx={{ ml: "auto", fontFamily: CORE_FONTS.find((f) => f.id === p.font)?.family, color: s.roles.text.main }}>Aa</Typography>
      </Box>
    </ChoiceTile>
  );
}
