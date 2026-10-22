import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import { GLOW_PALETTES, GRADIENT_NONE_ID, GRADIENT_PALETTES, gradientCss, isGlowId } from "./gradientPalettes";
import { PRIMARY_SWATCHES, TEXT_SIZES, normalizeAccentHex, normalizeBellPrefs, type BellPrefs, type ThemePrefs, withLook } from "./themePrefs";
import { listLooks, resolveLook } from "./looks/registry";
import { chosenLookButtons } from "../lib/look-font";
import { BACKGROUND_EFFECTS, EFFECT_AMOUNTS, EFFECT_COLOURS, EFFECT_SPEEDS, type EffectColour } from "./effects/catalog";
import { useReducedMotion } from "./effects/BackgroundEffects";
import type { UiSkin } from "./types";
import { choiceSx, insetSx } from "./surfaceStyles";
import { ButtonRow } from "../components/ButtonRow";
import { ROOM_NAVS } from "../lib/room-nav";
import { AppearancePreview } from "../components/appearance/AppearancePreview";
import { HARMONIES } from "../lib/appearance/scale";
import { CORE_FONTS, FONT_GROUPS, DEFAULT_FONT_ID } from "../lib/appearance/fonts";
import { THEME_PRESETS, type ThemePreset } from "../lib/appearance/presets";
import { MINE_GLOW_ID, MINE_GRADIENT_ID, isMineBackground, mineBackground, schemeForPrefs } from "./appearance-scheme";
import { fontFamilyFor } from "./looks/resolve";

type Props = {
  themePrefs: ThemePrefs;
  skinId: string;
  skins: UiSkin[];
  onThemeChange: (prefs: ThemePrefs) => void;
  onSkinChange: (skinId: string) => void;
  /** Optional footnote under the controls */
  footnote?: string;
};

type BackgroundKind = "plain" | "mine" | "glow" | "gradient";

const BACKGROUND_HINT: Record<BackgroundKind, string> = {
  plain: "A plain page in the scheme's own colour.",
  mine: "Made from your three colours, so it always matches.",
  glow: "Pools of soft light. Each works in Light and Dark mode.",
  gradient: "Two colours blending across the page.",
};

function kindOf(gradientId: string | undefined): BackgroundKind {
  if (!gradientId || gradientId === GRADIENT_NONE_ID) return "plain";
  if (isMineBackground(gradientId)) return "mine";
  return isGlowId(gradientId) ? "glow" : "gradient";
}

/** One group of settings: a numbered heading, what it does, and its controls. */
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Box component="section">
      <Typography variant="subtitle1">
        {title}
      </Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {hint}
        </Typography>
      )}
      {children}
    </Box>
  );
}

/** A labelled row inside a section. */
function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" fontWeight="fontWeightBold" sx={{ mb: 1 }}>
        {label}
        {hint ? (
          <Typography component="span" variant="caption" color="text.secondary">
            {" "}
            — {hint}
          </Typography>
        ) : null}
      </Typography>
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
    <ToggleButtonGroup exclusive size="small" value={value} disabled={disabled} aria-label={label} onChange={(_, v: T | null) => v !== null && onChange(v)} sx={{ flexWrap: "wrap" }}>
      {options.map((o) => (
        <ToggleButton key={String(o.value)} value={o.value} sx={{ px: 1.5 }}>
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/** A choice tile: a name and a line about it (Looks, effects, menus…). */
function ChoiceTile({ selected, onClick, title, text, children, sx }: { selected: boolean; onClick: () => void; title: ReactNode; text?: ReactNode; children?: ReactNode; sx?: object }) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      sx={[
        { width: "100%", height: "100%", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", justifyItems: "start", alignContent: "start", textAlign: "left", gap: 0.25, px: 1.25, py: 1 },
        choiceSx(selected),
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

/** A round colour swatch: a colour sample to pick, not a button of the Look. */
function Swatch({ colour, label, selected, onClick }: { colour: string; label: string; selected: boolean; onClick: () => void }) {
  return (
    <Tooltip title={label}>
      <ButtonBase
        aria-label={label}
        aria-pressed={selected}
        onClick={onClick}
        sx={(t) => ({
          width: 32,
          height: 32,
          borderRadius: "50%",
          bgcolor: colour,
          outline: selected ? `2px solid ${t.nxScheme.text.main}` : "none",
          outlineOffset: 2,
          "&:hover": { opacity: 0.9 },
        })}
      />
    </Tooltip>
  );
}

/**
 * Settings → Appearance (and Users → Edit): one theme made of a style, a mode, three colours, a
 * background and a font — with a live preview and ready-made themes. Every colour comes from the
 * Appearance engine (lib/appearance), which keeps all text readable.
 */
export function ThemeOptionsFields({ themePrefs, skinId, skins, onThemeChange, onSkinChange, footnote }: Props) {
  const [customHex, setCustomHex] = useState(themePrefs.primary);
  const [kind, setKind] = useState<BackgroundKind>(() => kindOf(themePrefs.gradientId));
  const reducedMotion = useReducedMotion();
  const deviceDark = useMediaQuery("(prefers-color-scheme: dark)");
  const wide = useMediaQuery("(min-width: 1200px)");
  const look = resolveLook(themePrefs.lookId);
  const effectId = themePrefs.effectId ?? "off";
  const set = (patch: Partial<ThemePrefs>) => onThemeChange({ ...themePrefs, ...patch });
  const bell = normalizeBellPrefs(themePrefs.bell);
  const mode = look.forceMode ?? (themePrefs.autoMode ? (deviceDark ? "dark" : "light") : themePrefs.mode);
  const scheme = useMemo(() => schemeForPrefs({ ...themePrefs, mode }, mode, Boolean(look.frosted)), [themePrefs, mode, look]);

  useEffect(() => setCustomHex(themePrefs.primary), [themePrefs.primary]);
  useEffect(() => setKind(kindOf(themePrefs.gradientId)), [themePrefs.gradientId]);

  function chooseKind(next: BackgroundKind) {
    setKind(next);
    if (next === "plain") set({ gradientId: GRADIENT_NONE_ID });
    else if (kindOf(themePrefs.gradientId) !== next) {
      set({ gradientId: next === "mine" ? MINE_GLOW_ID : (next === "glow" ? GLOW_PALETTES : GRADIENT_PALETTES)[0]!.id });
    }
  }

  function applyCustomHex(raw: string) {
    setCustomHex(raw);
    const normalized = normalizeAccentHex(raw);
    if (normalized) set({ primary: normalized });
  }

  function applyPreset(p: ThemePreset) {
    onThemeChange({
      ...withLook(themePrefs, resolveLook(p.lookId).id === p.lookId ? p.lookId : "standard"),
      mode: p.mode,
      autoMode: false,
      primary: p.primary,
      harmony: p.harmony,
      gradientId: p.gradientId,
      lookFont: p.font,
    });
  }

  // Fonts: Nexternel's built-in ones, plus any a Look brings of its own.
  const lookOwnFonts = (look.fonts ?? []).filter((f) => !CORE_FONTS.some((c) => c.id === f.id));
  const fontId = themePrefs.lookFont ?? look.fonts?.[0]?.id ?? DEFAULT_FONT_ID;
  const presetPreview = (p: ThemePreset) => {
    const pPrefs: ThemePrefs = { ...themePrefs, lookId: p.lookId, mode: p.mode, autoMode: false, primary: p.primary, harmony: p.harmony, gradientId: p.gradientId };
    const s = schemeForPrefs(pPrefs, p.mode, Boolean(resolveLook(p.lookId).frosted));
    const bg = isMineBackground(p.gradientId) ? mineBackground(s, p.gradientId).css : (gradientCss(p.gradientId, p.mode) ?? s.roles.surfaceSolid.background);
    return { s, bg };
  };
  const swatches = kind === "glow" ? GLOW_PALETTES : kind === "gradient" ? GRADIENT_PALETTES : [];

  const settings = (
    <Stack spacing={3.5} divider={<Divider flexItem />}>
      <Section title="Ready-made themes" hint="A starting point: style, mode, colours, background and font together. Change anything afterwards.">
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 1 }}>
          {THEME_PRESETS.filter((p) => resolveLook(p.lookId).id === p.lookId).map((p) => {
            const { s, bg } = presetPreview(p);
            const selected =
              themePrefs.primary.toUpperCase() === p.primary && (themePrefs.lookId ?? "standard") === p.lookId && mode === p.mode && (themePrefs.gradientId ?? "none") === p.gradientId;
            return (
              <ChoiceTile key={p.id} selected={selected} onClick={() => applyPreset(p)} title={p.label} text={p.description}>
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
                  <Typography sx={{ ml: "auto", fontFamily: CORE_FONTS.find((f) => f.id === p.font)?.family, color: s.roles.text.main, typography: "subtitle2" }}>Aa</Typography>
                </Box>
              </ChoiceTile>
            );
          })}
        </Box>
      </Section>

      <Section title="Style" hint="How panels, frames, buttons and switches are drawn. Standard is solid; Glass is see-through over the background.">
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 1 }}>
          {listLooks().map((l) => (
            <ChoiceTile key={l.id} selected={look.id === l.id} onClick={() => onThemeChange(withLook(themePrefs, l.id))} title={l.label} text={l.description} />
          ))}
        </Box>
        {(look.buttonStyles?.length ?? 0) > 1 ? (
          <Row label="Buttons" hint={`how buttons are drawn while ${look.label} is chosen`}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 1 }}>
              {look.buttonStyles!.map((b) => (
                <ChoiceTile key={b.id} selected={chosenLookButtons(look, themePrefs.lookButtons)?.id === b.id} onClick={() => set({ lookButtons: b.id })} title={b.label} text={b.description} />
              ))}
            </Box>
          </Row>
        ) : null}
      </Section>

      <Section
        title="Mode"
        hint={look.forceMode ? `${look.label} is always ${look.forceMode}. Your choice comes back with other styles.` : "Light, dark, or follow this device's own setting (light by day, dark by night if it does that)."}
      >
        <ButtonRow direction="row">
          {([
            ["light", "Light", <LightModeIcon key="l" />],
            ["dark", "Dark", <DarkModeIcon key="d" />],
            ["auto", "Automatic", <BrightnessAutoIcon key="a" />],
          ] as const).map(([value, label, icon]) => {
            const on = value === "auto" ? Boolean(themePrefs.autoMode) : !themePrefs.autoMode && themePrefs.mode === value;
            return (
              <Button
                key={value}
                variant={on ? "contained" : "outlined"}
                startIcon={icon}
                disabled={Boolean(look.forceMode)}
                onClick={() => set(value === "auto" ? { autoMode: true } : { mode: value, autoMode: false })}
                sx={{ minWidth: 110 }}
              >
                {label}
              </Button>
            );
          })}
        </ButtonRow>
      </Section>

      <Section title="Colours" hint="Three colours that work together. Nexternel keeps every text readable: a colour is made a little lighter or darker where needed, never changed.">
        <Row label="Main colour" hint="buttons, chosen items, the switch when on">
          <ButtonRow direction="row" flexWrap="wrap" useFlexGap>
            {PRIMARY_SWATCHES.map((s) => (
              <Swatch key={s.id} colour={s.color} label={s.label} selected={themePrefs.primary.toLowerCase() === s.color.toLowerCase()} onClick={() => set({ primary: s.color })} />
            ))}
          </ButtonRow>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
            <TextField
              size="small"
              label="Any colour"
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
          </Stack>
        </Row>
        <Row label="Second and third colours" hint="big values (temperatures, clock, energy) and highlights (charts)">
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 1 }}>
            {HARMONIES.map((h) => (
              <ChoiceTile key={h.id} selected={(themePrefs.harmony ?? "split") === h.id} onClick={() => set({ harmony: h.id, ...(h.id === "custom" ? { second: themePrefs.second ?? scheme.input.second, third: themePrefs.third ?? scheme.input.third } : {}) })} title={h.label} text={h.description} />
            ))}
          </Box>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
            {(["main", "second", "third"] as const).map((k) => (
              <Stack key={k} direction="row" spacing={1} alignItems="center">
                <Box sx={[insetSx(), { width: 28, height: 28, borderRadius: "50%", bgcolor: scheme.roles[k].solid }]} />
                <Typography variant="body2">{k === "main" ? "Main" : k === "second" ? "Second" : "Third"}</Typography>
                {(themePrefs.harmony ?? "split") === "custom" && k !== "main" ? (
                  <TextField
                    size="small"
                    type="color"
                    aria-label={`${k} colour`}
                    value={(k === "second" ? themePrefs.second : themePrefs.third) ?? scheme.input[k] ?? "#888888"}
                    onChange={(e) => {
                      const n = normalizeAccentHex(e.target.value);
                      if (n) set(k === "second" ? { second: n } : { third: n });
                    }}
                    sx={{ width: 64, "& input": { cursor: "pointer", p: 0.5, height: 24 } }}
                  />
                ) : null}
              </Stack>
            ))}
          </Stack>
        </Row>
      </Section>

      <Section title="Background" hint={BACKGROUND_HINT[kind]}>
        <Segmented
          label="Background type"
          value={kind}
          onChange={chooseKind}
          options={[
            { value: "plain", label: "Plain" },
            { value: "mine", label: "From my colours" },
            { value: "glow", label: "Soft glow" },
            { value: "gradient", label: "Gradient" },
          ]}
        />
        {kind === "mine" ? (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 1, mt: 1.5 }}>
            {[
              [MINE_GLOW_ID, "Glow", "Soft pools of your three colours."],
              [MINE_GRADIENT_ID, "Gradient", "Your main and second colour blending."],
            ].map(([id, label, text]) => (
              <ChoiceTile key={id} selected={themePrefs.gradientId === id} onClick={() => set({ gradientId: id })} title={label} text={text}>
                <Box aria-hidden sx={[insetSx(), { width: "100%", height: 40, mb: 0.5, backgroundImage: mineBackground(scheme, id).css }]} />
              </ChoiceTile>
            ))}
          </Box>
        ) : null}
        {swatches.length > 0 && (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 1, mt: 1.5 }}>
            {swatches.map((g) => {
              const selected = themePrefs.gradientId === g.id;
              return (
                <ButtonBase
                  key={g.id}
                  onClick={() => set({ gradientId: g.id })}
                  aria-pressed={selected}
                  aria-label={g.label}
                  sx={{ width: "100%", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", justifyItems: "stretch", alignContent: "start", gap: 0.5, p: 0.5, borderRadius: 1.5, textAlign: "left", border: "2px solid", borderColor: selected ? "text.primary" : "transparent" }}
                >
                  <Box sx={[insetSx(), { width: "100%", height: 40, backgroundImage: gradientCss(g.id, mode) ?? undefined }]} />
                  <Typography variant="caption" color={selected ? "text.primary" : "text.secondary"} sx={{ lineHeight: 1.2, px: 0.25 }}>
                    {g.label}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        )}
      </Section>

      <Section title="Font and text size" hint="One font for all text, in every style. Built into Nexternel, so it works without the internet.">
        {[...FONT_GROUPS.map((g) => ({ label: g.label, fonts: CORE_FONTS.filter((f) => f.group === g.id).map((f) => ({ id: f.id, label: f.label, family: f.family, text: f.description })) })),
          ...(lookOwnFonts.length ? [{ label: `${look.label} fonts`, fonts: lookOwnFonts.map((f) => ({ id: f.id, label: f.label, family: f.family, text: `Made for ${look.label}.` })) }] : [])].map((group) => (
          <Row key={group.label} label={group.label}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 1 }}>
              {group.fonts.map((f) => (
                <ChoiceTile key={f.id} selected={fontId === f.id} onClick={() => set({ lookFont: f.id })} title={<Box component="span" sx={{ fontFamily: f.family, typography: "subtitle1" }}>{f.label}</Box>} text={f.text}>
                  <Typography aria-hidden variant="h5" sx={{ fontFamily: f.family, lineHeight: 1.1, color: "secondary.main" }}>
                    21.4°
                  </Typography>
                </ChoiceTile>
              ))}
            </Box>
          </Row>
        ))}
        <Row label="Text size" hint="all text in Nexternel, on this account">
          <ToggleButtonGroup exclusive size="small" value={themePrefs.textSize ?? 100} onChange={(_, v: number | null) => v && set({ textSize: v })} aria-label="Text size">
            {TEXT_SIZES.map((s) => (
              <ToggleButton key={s.value} value={s.value}>
                {s.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Row>
      </Section>

      <Section title="Background effect" hint="A gentle animation behind your dashboards.">
        {reducedMotion && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            This device asks apps to reduce motion, so effects stay still here.
          </Alert>
        )}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 1 }}>
          {BACKGROUND_EFFECTS.map((e) => (
            <ChoiceTile key={e.id} selected={effectId === e.id} onClick={() => set({ effectId: e.id })} title={e.label} text={e.description} />
          ))}
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
              <Segmented label={label} value={themePrefs[key] ?? 1} options={options} disabled={effectId === "off"} onChange={(v) => set({ [key]: v })} />
            </Stack>
          ))}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ width: 64, flexShrink: 0 }}>
              Colour
            </Typography>
            <Segmented<EffectColour> label="Effect colour" value={themePrefs.effectColour ?? "white"} options={EFFECT_COLOURS} disabled={effectId === "off"} onChange={(v) => set({ effectColour: v })} />
          </Stack>
        </Stack>
      </Section>

      <Section title="Dashboards" hint="How you move between dashboards, and moving decorations.">
        <Row label="Dashboard Menu" hint="where your dashboards are listed; phones always use the dock">
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 1 }}>
            {ROOM_NAVS.map((n) => (
              <ChoiceTile key={n.value} selected={(themePrefs.roomNav ?? "dock") === n.value} onClick={() => set({ roomNav: n.value })} title={n.label} text={n.description} />
            ))}
          </Box>
        </Row>
        <FormControlLabel
          sx={{ mt: 1.5 }}
          control={<Switch checked={themePrefs.motion !== false} onChange={(e) => set({ motion: e.target.checked })} />}
          label={
            <Typography variant="body2">
              Animations{" "}
              <Typography component="span" variant="caption" color="text.secondary">
                — moving frames, rings and lights in styles that have them. Each panel can choose its own in Edit → Look.
              </Typography>
            </Typography>
          }
        />
      </Section>

      <Section
        title="Notification bell"
        hint="Messages from Nexternel and plugins. Its number has the colour of the most important new message: your main colour for information, amber for keep an eye on it, red for act now."
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
            "Next to the dashboard options" puts it beside the cog above your dashboards; on other pages it stays at the top of the side menu. On phones and
            with the top menu layout it sits in the top bar. Which plugin messages reach the bell is set for each plugin in Settings → Plugins.
          </Typography>
        </Stack>
      </Section>

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

      {footnote ? (
        <Typography variant="caption" color="text.secondary">
          {footnote}
        </Typography>
      ) : null}
    </Stack>
  );

  // Wide screens: settings on the left, the preview beside them staying in view; else preview first.
  return wide ? (
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(380px, 0.9fr)", gap: 3, alignItems: "start" }}>
      {settings}
      <Box sx={{ position: "sticky", top: 16 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Preview
        </Typography>
        <AppearancePreview prefs={themePrefs} deviceDark={deviceDark} />
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, fontFamily: fontFamilyFor(look, themePrefs.lookFont) }}>
          Font: {CORE_FONTS.find((f) => f.id === fontId)?.label ?? look.fonts?.find((f) => f.id === fontId)?.label ?? "Inter"}
        </Typography>
      </Box>
    </Box>
  ) : (
    <Stack spacing={3}>
      <AppearancePreview prefs={themePrefs} deviceDark={deviceDark} />
      {settings}
    </Stack>
  );
}
