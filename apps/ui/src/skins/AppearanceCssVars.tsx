import { useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import { Box, GlobalStyles } from "@mui/material";
import { useTheme, alpha, type Theme } from "@mui/material/styles";
import { metricValueColorFromTheme } from "./metricColors";
import { listLooks, resolveLook } from "./looks/registry";
import { lookStyleSheet } from "./looks/look-css";
import type { UiLook } from "./looks/types";
import { chosenLookButtons } from "../lib/look-font";

/**
 * Appearance tokens as CSS variables — any widget/plugin can use these without
 * importing MUI (clock, future plugins, SVG, canvas). The Look's shape tokens are here too
 * (--nx-panel-radius and friends). A Look is placed on a box: the page (<html data-nx-look>), or a
 * LookBox inside it (the Look tiles in Settings → Appearance), each with its own Look.
 */
function useLookVars(theme: Theme, look: UiLook): Record<string, string> {
  return useMemo(() => {

    const accent = theme.palette.primary.main;
    const metricValue = metricValueColorFromTheme(theme);
    const t = theme.nx;
    const R = theme.nxScheme;
    // Every role of the Appearance engine as a CSS variable (pages, charts, plugins can use them).
    const roleVars: Record<string, string> = R
      ? {
          "--nx-page": R.surface.background,
          "--nx-frame": R.surface.frame,
          "--nx-panel": R.surface.panel,
          "--nx-popup": R.surface.popup,
          "--nx-control": R.surface.control,
          "--nx-control-hover": R.surface.controlHover,
          "--nx-text": R.text.main,
          "--nx-text-quiet": R.text.quiet,
          "--nx-edge": R.line.edge,
          "--nx-line": R.line.divider,
          "--nx-control-edge": R.line.control,
          "--nx-focus": R.line.focus,
          "--nx-value": R.value,
          ...Object.fromEntries(
            (["main", "second", "third"] as const).flatMap((k) => [
              [`--nx-${k}`, R[k].solid],
              [`--nx-${k}-hover`, R[k].solidHover],
              [`--nx-${k}-ink`, R[k].ink],
              [`--nx-${k}-soft`, R[k].soft],
              [`--nx-${k}-text`, R[k].text],
            ])
          ),
          ...Object.fromEntries(
            (["ok", "watch", "alert"] as const).flatMap((k) => [
              [`--nx-status-${k}`, R.status[k].solid],
              [`--nx-status-${k}-text`, R.status[k].text],
            ])
          ),
          ...Object.fromEntries(R.series.map((c, i) => [`--nx-series-${i + 1}`, c])),
        }
      : {};
    return {
      ...roleVars,
      "--nx-accent": accent,
      "--nx-accent-soft": alpha(accent, theme.palette.mode === "dark" ? 0.72 : 0.55),
      // Big values: the scheme's value colour (the second colour), the same in every panel.
      "--nx-metric-value": R ? R.value : metricValue,
      "--nx-text-primary": theme.palette.text.primary,
      "--nx-text-secondary": theme.palette.text.secondary,
      "--nx-surface-paper": theme.palette.background.paper,
      "--nx-divider": alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.22 : 0.18),
      "--nx-panel-radius": t.panelRadius,
      "--nx-panel-border": t.panelBorder,
      "--nx-panel-shadow": t.panelShadow,
      "--nx-main-tile-radius": t.mainTileRadius,
      "--nx-tile-radius": t.tileRadius,
      "--nx-mini-panel-radius": t.miniPanelRadius,
      "--nx-mini-panel-border": t.miniPanelBorder,
      "--nx-panel-inset": t.panelInset,
      // Space between neighbouring buttons / menu entries, with room for the Look's button decoration.
      "--nx-decor-reach": t.decorReach,
      "--nx-control-gap": `calc(${t.controlGap} + 2 * ${t.decorReach})`,
      "--nx-list-gap": `calc(8px + 2 * ${t.decorReach})`,
      "--nx-title-inset": t.titleInset,
      "--nx-heading-case": t.headingCase,
      "--nx-heading-spacing": t.headingSpacing,
      "--nx-control-radius": t.controlRadius,
      "--nx-pill-radius": t.pillRadius,
      "--nx-control-surface": t.controlSurface,
      "--nx-control-raise": t.controlRaise,
      "--nx-control-press": t.controlPress,
      "--nx-knob": t.knob,
      "--nx-knob-shadow": t.knobShadow,
      "--nx-track-on": t.trackOn,
      "--nx-accent-ink": t.accentInk,
      "--nx-accent-pale": t.accentSoft,
      "--nx-chip": t.chip,
      "--nx-glow": t.glow,
      "--nx-text-glow": t.textGlow,
      ...(t.gearFill ? { "--nx-gear-fill": t.gearFill } : {}),
      ...(t.gearStroke ? { "--nx-gear-stroke": t.gearStroke } : {}),
      ...(t.gearStrokeWidth ? { "--nx-gear-stroke-width": t.gearStrokeWidth } : {}),
      ...(t.gearShadow ? { "--nx-gear-shadow": t.gearShadow } : {}),
      ...(t.panelFill ? { "--nx-panel-fill": t.panelFill } : {}),
      ...(t.tileFill ? { "--nx-tile-fill": t.tileFill } : {}),
      ...(t.tileBorder ? { "--nx-tile-border": t.tileBorder } : {}),
      ...(t.tileShadow ? { "--nx-tile-shadow": t.tileShadow } : {}),
    } as Record<string, string>;
  }, [theme, look]);
}

/** The page's Look: its values on :root, its id and button style on <html>, and every Look's own CSS. */
export function AppearanceCssVars({
  lookId,
  buttonsId,
  looksVersion = 0,
}: {
  lookId?: string;
  /** The person's button style choice (used when the Look offers button styles). */
  buttonsId?: string;
  looksVersion?: number;
}) {
  const theme = useTheme();
  // looksVersion: a Look from an add-on may arrive after the first draw.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- looksVersion
  const look = useMemo(() => resolveLook(lookId), [lookId, looksVersion]);
  const vars = useLookVars(theme, look);

  useEffect(() => {
    document.documentElement.setAttribute("data-nx-look", look.id);
  }, [look.id]);

  // The chosen button style, for the Look's css: <html data-nx-buttons="id">.
  const buttons = chosenLookButtons(look, buttonsId)?.id;
  useEffect(() => {
    if (buttons) document.documentElement.setAttribute("data-nx-buttons", buttons);
    else document.documentElement.removeAttribute("data-nx-buttons");
  }, [buttons]);

  // Every Look's own CSS (fonts, frames, button styles) in one <style>, each limited to the boxes
  // drawn in that Look (looks/look-css.ts), so a Look tile can show another Look than the page.
  useEffect(() => {
    const id = "nx-look-css";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    const css = lookStyleSheet(listLooks(), look.id);
    if (!css) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = css;
  }, [look.id, looksVersion]);

  return <GlobalStyles styles={{ ":root": vars }} />;
}

/**
 * A box drawn in a Look of its own inside the page (the Look and button style tiles): the Look's
 * values, id and button style on the box instead of the page, and the text colour and font the page
 * would give. Its theme comes from the LookLayer around it (LookLayer scoped).
 */
export function LookBox({
  lookId,
  buttonsId,
  looksVersion = 0,
  style,
  children,
}: {
  lookId?: string;
  buttonsId?: string;
  looksVersion?: number;
  /** The box's own background and size, if any. */
  style?: CSSProperties;
  children: ReactNode;
}) {
  const theme = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- looksVersion
  const look = useMemo(() => resolveLook(lookId), [lookId, looksVersion]);
  const vars = useLookVars(theme, look);
  const buttons = chosenLookButtons(look, buttonsId)?.id;
  return (
    <Box
      data-nx-look={look.id}
      data-nx-buttons={buttons}
      style={{ ...vars, ...style } as CSSProperties}
      sx={{ color: "text.primary", fontFamily: theme.typography.fontFamily, ...theme.typography.body1 }}
    >
      {children}
    </Box>
  );
}
