import { useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Divider,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import {
  GLOW_PALETTES,
  GRADIENT_NONE_ID,
  GRADIENT_PALETTES,
  getGradientPalette,
  gradientCss,
  isGlowId,
} from "./gradientPalettes";
import {
  PRIMARY_SWATCHES,
  normalizeAccentHex,
  normalizeBellPrefs,
  type BellPrefs,
  type ThemePrefs,
  withLook,
} from "./themePrefs";
import { listLooks, resolveLook } from "./looks/registry";
import { isGradientActive } from "./surfaceStyles";
import {
  BACKGROUND_EFFECTS,
  EFFECT_AMOUNTS,
  EFFECT_COLOURS,
  EFFECT_SPEEDS,
  type EffectColour,
} from "./effects/catalog";
import { useReducedMotion } from "./effects/BackgroundEffects";
import type { UiSkin } from "./types";
import { choiceSx, insetSx } from "./surfaceStyles";

type Props = {
  themePrefs: ThemePrefs;
  skinId: string;
  skins: UiSkin[];
  onThemeChange: (prefs: ThemePrefs) => void;
  onSkinChange: (skinId: string) => void;
  /** Optional footnote under the controls */
  footnote?: string;
};

type BackgroundKind = "plain" | "glow" | "gradient";

const BACKGROUND_HINT: Record<BackgroundKind, string> = {
  plain: "The standard light or dark background.",
  glow: "Pools of soft light. The pale ones in the second row switch to Light mode.",
  gradient: "Two colours blending across the page.",
};

function kindOf(gradientId: string | undefined): BackgroundKind {
  if (!gradientId || gradientId === GRADIENT_NONE_ID) return "plain";
  return isGlowId(gradientId) ? "glow" : "gradient";
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {title}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {hint}
        </Typography>
      )}
      {children}
    </Box>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(_, v: T | null) => v !== null && onChange(v)}
      sx={{ flexWrap: "wrap" }}
    >
      {options.map((o) => (
        <ToggleButton key={String(o.value)} value={o.value} sx={{ px: 1.5, textTransform: "none" }}>
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/**
 * Colour mode, background, accent, background effect, panels and layout.
 * Used by Settings → Appearance and Users → Edit.
 */
export function ThemeOptionsFields({ themePrefs, skinId, skins, onThemeChange, onSkinChange, footnote }: Props) {
  const [customHex, setCustomHex] = useState(themePrefs.primary);
  const [kind, setKind] = useState<BackgroundKind>(() => kindOf(themePrefs.gradientId));
  const reducedMotion = useReducedMotion();
  const backdrop = isGradientActive(themePrefs);
  const background = getGradientPalette(themePrefs.gradientId);
  const effectId = themePrefs.effectId ?? "off";
  const set = (patch: Partial<ThemePrefs>) => onThemeChange({ ...themePrefs, ...patch });
  const bell = normalizeBellPrefs(themePrefs.bell);

  useEffect(() => setCustomHex(themePrefs.primary), [themePrefs.primary]);
  useEffect(() => setKind(kindOf(themePrefs.gradientId)), [themePrefs.gradientId]);

  function chooseKind(next: BackgroundKind) {
    setKind(next);
    if (next === "plain") set({ gradientId: GRADIENT_NONE_ID });
    else if (kindOf(themePrefs.gradientId) !== next) {
      set({ gradientId: (next === "glow" ? GLOW_PALETTES : GRADIENT_PALETTES)[0]!.id });
    }
  }

  function applyCustomHex(raw: string) {
    setCustomHex(raw);
    const normalized = normalizeAccentHex(raw);
    if (normalized) set({ primary: normalized });
  }

  const swatches = kind === "glow" ? GLOW_PALETTES : kind === "gradient" ? GRADIENT_PALETTES : [];

  return (
    <Stack spacing={3}>
      <Section
        title="Look"
        hint={
          resolveLook(themePrefs.lookId).frosted && !backdrop
            ? "Glass panels show the background through them. Choose a background below."
            : "How panels, tiles and switches are drawn."
        }
      >
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 1 }}>
          {listLooks().map((look) => {
            const selected = resolveLook(themePrefs.lookId).id === look.id;
            return (
              <ButtonBase
                key={look.id}
                onClick={() => onThemeChange(withLook(themePrefs, look.id))}
                aria-pressed={selected}
                sx={[
                  {
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr)",
                  justifyItems: "start",
                  alignContent: "start",
                  textAlign: "left",
                  gap: 0.25,
                  px: 1.25,
                  py: 1,
                },
                choiceSx(selected),
              ]}
              >
                <Typography variant="body2" fontWeight={600}>
                  {look.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {look.description}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>
        <FormControlLabel
          sx={{ mt: 1 }}
          control={<Switch checked={themePrefs.motion !== false} onChange={(e) => set({ motion: e.target.checked })} />}
          label={
            <Typography variant="body2">
              Animations{" "}
              <Typography component="span" variant="caption" color="text.secondary">
                — moving frames, rings and lights in Looks that have them. Each panel can choose its own in Edit → Look.
              </Typography>
            </Typography>
          }
        />
      </Section>

      <Divider />

      <Section
        title="Colour mode"
        hint={
          resolveLook(themePrefs.lookId).forceMode
            ? `${resolveLook(themePrefs.lookId).label} is always ${resolveLook(themePrefs.lookId).forceMode}. Your choice comes back with other Looks.`
            : undefined
        }
      >
        <Stack direction="row" spacing={1}>
          {(["light", "dark"] as const).map((mode) => (
            <Button
              key={mode}
              size="small"
              variant={themePrefs.mode === mode ? "contained" : "outlined"}
              startIcon={mode === "light" ? <LightModeIcon /> : <DarkModeIcon />}
              onClick={() => set({ mode })}
              sx={{ minWidth: 96 }}
            >
              {mode === "light" ? "Light" : "Dark"}
            </Button>
          ))}
        </Stack>
      </Section>

      <Section title="Background" hint={BACKGROUND_HINT[kind]}>
        <Segmented
          label="Background type"
          value={kind}
          onChange={chooseKind}
          options={[
            { value: "plain", label: "Plain" },
            { value: "glow", label: "Soft glow" },
            { value: "gradient", label: "Gradient" },
          ]}
        />
        {swatches.length > 0 && (
          <Box
            sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 1, mt: 1.5 }}
          >
            {swatches.map((g) => {
              const selected = themePrefs.gradientId === g.id;
              return (
                <ButtonBase
                  key={g.id}
                  onClick={() =>
                    // A light glow needs dark text: it brings Light mode along.
                    set(g.glow?.light ? { gradientId: g.id, mode: "light" } : { gradientId: g.id })
                  }
                  aria-pressed={selected}
                  aria-label={g.label}
                  sx={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr)",
                    justifyItems: "stretch",
                    alignContent: "start",
                    gap: 0.5,
                    p: 0.5,
                    borderRadius: 1.5,
                    textAlign: "left",
                    border: "2px solid",
                    borderColor: selected ? "text.primary" : "transparent",
                  }}
                >
                  <Box
                    sx={[
                      insetSx(),
                      {
                        width: "100%",
                        height: 40,
                        backgroundImage: gradientCss(g.id, g.glow?.light ? "light" : themePrefs.mode) ?? undefined,
                      },
                    ]}
                  />
                  <Typography
                    variant="caption"
                    color={selected ? "text.primary" : "text.secondary"}
                    sx={{ lineHeight: 1.2, px: 0.25 }}
                  >
                    {g.label}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        )}
      </Section>

      <Section title="Accent colour" hint="For menus, tabs and buttons.">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {PRIMARY_SWATCHES.map((s) => {
            const selected = themePrefs.primary.toLowerCase() === s.color.toLowerCase();
            return (
              <Tooltip key={s.id} title={s.label}>
                <IconButton
                  aria-label={s.label}
                  aria-pressed={selected}
                  onClick={() => set({ primary: s.color })}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: s.color,
                    border: "2px solid",
                    borderColor: selected ? "text.primary" : "transparent",
                    "&:hover": { bgcolor: s.color, opacity: 0.9 },
                  }}
                />
              </Tooltip>
            );
          })}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
          <TextField
            size="small"
            label="Custom colour"
            value={customHex}
            onChange={(e) => applyCustomHex(e.target.value)}
            placeholder="#1A73E8"
            inputProps={{ maxLength: 7, spellCheck: false }}
            sx={{ width: 150 }}
            error={Boolean(customHex.trim()) && !normalizeAccentHex(customHex)}
            helperText={!customHex.trim() || normalizeAccentHex(customHex) ? undefined : "Use #RRGGBB"}
          />
          <TextField
            size="small"
            type="color"
            label="Picker"
            value={normalizeAccentHex(themePrefs.primary) ?? "#1A73E8"}
            onChange={(e) => {
              const n = normalizeAccentHex(e.target.value);
              if (n) set({ primary: n });
            }}
            sx={{ width: 80, "& input": { cursor: "pointer", p: 0.5, height: 28 } }}
            InputLabelProps={{ shrink: true }}
          />
          {background && (
            <Button size="small" variant="outlined" onClick={() => set({ primary: background.from.toUpperCase() })}>
              Match the background
            </Button>
          )}
        </Stack>
      </Section>

      <Section title="Background effect" hint="A gentle animation behind your dashboards.">
        {reducedMotion && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            This device asks apps to reduce motion, so effects stay still here.
          </Alert>
        )}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 1 }}>
          {BACKGROUND_EFFECTS.map((e) => {
            const selected = effectId === e.id;
            return (
              <ButtonBase
                key={e.id}
                onClick={() => set({ effectId: e.id })}
                aria-pressed={selected}
                sx={[
                  {
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr)",
                  justifyItems: "start",
                  alignContent: "start",
                  textAlign: "left",
                  gap: 0.25,
                  px: 1.25,
                  py: 1,
                },
                choiceSx(selected),
              ]}
              >
                <Typography variant="body2" fontWeight={600}>
                  {e.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {e.description}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>
        <Stack spacing={1.25} sx={{ mt: 1.5, opacity: effectId === "off" ? 0.5 : 1 }}>
          {(
            [
              ["Amount", "effectAmount", EFFECT_AMOUNTS],
              ["Speed", "effectSpeed", EFFECT_SPEEDS],
            ] as const
          ).map(([label, key, options]) => (
            <Stack key={key} direction="row" spacing={1.5} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ width: 64, flexShrink: 0 }}>
                {label}
              </Typography>
              <Segmented
                label={label}
                value={themePrefs[key] ?? 1}
                options={options}
                disabled={effectId === "off"}
                onChange={(v) => set({ [key]: v })}
              />
            </Stack>
          ))}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ width: 64, flexShrink: 0 }}>
              Colour
            </Typography>
            <Segmented<EffectColour>
              label="Effect colour"
              value={themePrefs.effectColour ?? "white"}
              options={EFFECT_COLOURS}
              disabled={effectId === "off"}
              onChange={(v) => set({ effectColour: v })}
            />
          </Stack>
        </Stack>
      </Section>

      <Divider />

      <Section
        title="Notification bell"
        hint="Messages from Nexternel and plugins. Its number has the colour of the most important new message: your accent colour for information, amber for keep an eye on it, red for act now."
      >
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ width: 64, flexShrink: 0 }}>
              Show
            </Typography>
            <Segmented<BellPrefs["show"]>
              label="When the bell shows"
              value={bell.show}
              options={[
                { value: "always", label: "Always" },
                { value: "new", label: "Only with new messages" },
                { value: "never", label: "Never" },
              ]}
              onChange={(v) => set({ bell: { ...bell, show: v } })}
            />
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ width: 64, flexShrink: 0 }}>
              Where
            </Typography>
            <Segmented<BellPrefs["position"]>
              label="Where the bell sits"
              value={bell.position}
              disabled={bell.show === "never"}
              options={[
                { value: "menu", label: "Top of the side menu" },
                { value: "top", label: "Next to the dashboard options" },
              ]}
              onChange={(v) => set({ bell: { ...bell, position: v } })}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            "Next to the dashboard options" puts it beside the cog above your dashboards; on other pages it stays
            at the top of the side menu. On phones and with the top menu layout it sits in the top bar. Which
            plugin messages reach the bell is set for each plugin in Settings → Plugins.
          </Typography>
        </Stack>
      </Section>

      <Divider />

      <Section title="Layout">
        <RadioGroup value={skinId} onChange={(e) => onSkinChange(e.target.value)}>
          {skins.map((s) => (
            <FormControlLabel
              key={s.id}
              value={s.id}
              control={<Radio size="small" />}
              label={
                <Box>
                  <Typography variant="body2">{s.label}</Typography>
                  {s.description && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {s.description}
                    </Typography>
                  )}
                </Box>
              }
            />
          ))}
        </RadioGroup>
      </Section>

      {footnote && (
        <Typography variant="caption" color="text.secondary">
          {footnote}
        </Typography>
      )}
    </Stack>
  );
}
