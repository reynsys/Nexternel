import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  ButtonBase,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import { GLOW_PALETTES, GRADIENT_NONE_ID, GRADIENT_PALETTES, gradientCss, isGlowId } from "./gradientPalettes";
import { PRIMARY_SWATCHES, TEXT_SIZES, normalizeAccentHex, type ThemePrefs, withLook } from "./themePrefs";
import { listLooks, resolveLook } from "./looks/registry";
import { chosenLookButtons } from "../lib/look-font";
import { BACKGROUND_EFFECTS, EFFECT_AMOUNTS, EFFECT_COLOURS, EFFECT_SPEEDS, type EffectColour } from "./effects/catalog";
import { EffectPicture, useEffectOptions, useReducedMotion } from "./effects/BackgroundEffects";
import type { UiSkin } from "./types";
import { choiceSx, insetSx } from "./surfaceStyles";
import { ButtonRow } from "../components/ButtonRow";
import { ROOM_NAVS } from "../lib/room-nav";
import { Segmented } from "../components/Segmented";
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

const TABS = [
  { id: "theme", label: "Theme" },
  { id: "style", label: "Style & colours" },
  { id: "background", label: "Background" },
  { id: "text", label: "Text" },
  { id: "dashboards", label: "Dashboards" },
] as const;

// The tab last open, so coming back to the page opens it again (this browser only).
const TAB_KEY = "nexternel.appearance.tab";
function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* only a convenience */
  }
}

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

/** A choice tile: a name and a line about it (Looks, effects, menus…). */
function ChoiceTile({ selected, onClick, title, text, children, sx, disabled }: { selected: boolean; onClick: () => void; title: ReactNode; text?: ReactNode; children?: ReactNode; sx?: object; disabled?: boolean }) {
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
  const tabIds: string[] = TABS.map((t) => t.id);
  const [tab, setTab] = useState(() => {
    const stored = readStored(TAB_KEY);
    return stored && tabIds.includes(stored) ? stored : "theme";
  });
  const [fontGroup, setFontGroup] = useState("all");
  const effectOptions = useEffectOptions(themePrefs);
  const deviceDark = useMediaQuery("(prefers-color-scheme: dark)");
  const wide = useMediaQuery("(min-width: 1200px)");
  const look = resolveLook(themePrefs.lookId);
  const effectId = themePrefs.effectId ?? "off";
  const set = (patch: Partial<ThemePrefs>) => onThemeChange({ ...themePrefs, ...patch });
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

  const modeTiles = (
    <Section
      title="Mode"
      hint={look.forceMode ? `${look.label} is always ${look.forceMode}. Your choice comes back with other styles.` : "Light, dark, or follow this device's own setting (light by day, dark by night if it does that)."}
    >
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 1 }}>
        {([
          ["light", "Light", <LightModeIcon key="l" fontSize="small" />],
          ["dark", "Dark", <DarkModeIcon key="d" fontSize="small" />],
          ["auto", "Automatic", <BrightnessAutoIcon key="a" fontSize="small" />],
        ] as const).map(([value, label, icon]) => {
          const on = value === "auto" ? Boolean(themePrefs.autoMode) : !themePrefs.autoMode && themePrefs.mode === value;
          return (
            <ChoiceTile
              key={value}
              selected={on}
              disabled={Boolean(look.forceMode)}
              onClick={() => set(value === "auto" ? { autoMode: true } : { mode: value, autoMode: false })}
              title={
                <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                  {icon}
                  {label}
                </Box>
              }
            />
          );
        })}
      </Box>
    </Section>
  );

  // Fonts as small rows, each written in its own letters; the buttons above show one group.
  const fontGroups = [
    ...FONT_GROUPS.map((g) => ({ id: g.id as string, label: g.label, fonts: CORE_FONTS.filter((f) => f.group === g.id).map((f) => ({ id: f.id, label: f.label, family: f.family, text: f.description })) })),
    ...(lookOwnFonts.length ? [{ id: "look", label: `${look.label} fonts`, fonts: lookOwnFonts.map((f) => ({ id: f.id, label: f.label, family: f.family, text: `Made for ${look.label}.` })) }] : []),
  ];
  const shownFonts = fontGroups.filter((g) => fontGroup === "all" || g.id === fontGroup).flatMap((g) => g.fonts);

  const textTab = (
    <Stack spacing={3.5} divider={<Divider flexItem />}>
      <Section title="Text size" hint="All text in Nexternel, on this account.">
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 1 }}>
          {TEXT_SIZES.map((t) => (
            <ChoiceTile
              key={t.value}
              selected={(themePrefs.textSize ?? 100) === t.value}
              onClick={() => set({ textSize: t.value })}
              title={t.label}
              sx={{ justifyItems: "center", textAlign: "center", py: 1.25 }}
            >
              <Typography aria-hidden sx={{ fontSize: `${(1.15 * t.value) / 100}rem`, fontWeight: "fontWeightBold", lineHeight: 1.2 }}>
                Aa
              </Typography>
            </ChoiceTile>
          ))}
        </Box>
      </Section>

      <Section title="Font" hint="One font for all text, in every style. Built into Nexternel, so it works without the internet.">
        <Segmented
          label="Font group"
          value={fontGroup}
          onChange={setFontGroup}
          options={[{ value: "all", label: "All" }, ...fontGroups.map((g) => ({ value: g.id, label: g.label }))]}
        />
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 1, mt: 1.5 }}>
          {shownFonts.map((f) => (
            <ButtonBase
              key={f.id}
              onClick={() => set({ lookFont: f.id })}
              aria-pressed={fontId === f.id}
              sx={[{ width: "100%", display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1, textAlign: "left" }, choiceSx(fontId === f.id)]}
            >
              <Typography aria-hidden variant="h6" sx={{ fontFamily: f.family, lineHeight: 1.1, color: "secondary.main", width: 72, flexShrink: 0 }}>
                21.4°
              </Typography>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography noWrap variant="body1" sx={{ fontFamily: f.family, fontWeight: "fontWeightBold" }}>
                  {f.label}
                </Typography>
                <Typography noWrap variant="caption" color="text.secondary" component="div">
                  {f.text}
                </Typography>
              </Box>
            </ButtonBase>
          ))}
        </Box>
      </Section>
    </Stack>
  );

  const effectTiles = (
    <Section title="Background effect" hint="A gentle animation behind your dashboards. Each tile shows how it moves.">
      {reducedMotion && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          This device asks apps to reduce motion, so effects stay still here.
        </Alert>
      )}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 1 }}>
        {BACKGROUND_EFFECTS.map((e) => (
          <ChoiceTile key={e.id} selected={effectId === e.id} onClick={() => set({ effectId: e.id })} title={e.label} text={e.description}>
            <Box aria-hidden sx={[insetSx(), { width: "100%", height: 64, mb: 0.5, overflow: "hidden", bgcolor: scheme.roles.surfaceSolid.background, position: "relative" }]}>
              {e.id === "off" ? (
                <Typography sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "text.secondary" }}>—</Typography>
              ) : (
                <EffectPicture options={{ ...effectOptions, id: e.id }} />
              )}
            </Box>
          </ChoiceTile>
        ))}
      </Box>
      {effectId !== "off" ? (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2, mt: 2 }}>
          {(
            [
              ["Amount", "effectAmount", EFFECT_AMOUNTS],
              ["Speed", "effectSpeed", EFFECT_SPEEDS],
            ] as const
          ).map(([label, key, options]) => (
            <Box key={key}>
              <Typography variant="body2" fontWeight="fontWeightBold" sx={{ mb: 1 }}>
                {label}
              </Typography>
              <Segmented label={label} value={themePrefs[key] ?? 1} options={options} onChange={(v) => set({ [key]: v })} />
            </Box>
          ))}
          <Box>
            <Typography variant="body2" fontWeight="fontWeightBold" sx={{ mb: 1 }}>
              Colour
            </Typography>
            <Segmented<EffectColour> label="Effect colour" value={themePrefs.effectColour ?? "white"} options={EFFECT_COLOURS} onChange={(v) => set({ effectColour: v })} />
          </Box>
        </Box>
      ) : null}
    </Section>
  );

  const dashboardsTab = (
    <Stack spacing={3.5} divider={<Divider flexItem />}>
      <Section title="Dashboards" hint="How you move between dashboards, and moving decorations.">
        <Row label="Dashboard menu" hint="where your dashboards are listed; phones always use the dock">
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

      <Section title="Layout" hint="How the whole app is laid out around your dashboards.">
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 1 }}>
          {skins.map((sk) => (
            <ChoiceTile key={sk.id} selected={skinId === sk.id} onClick={() => onSkinChange(sk.id)} title={sk.label} text={sk.description} />
          ))}
        </Box>
      </Section>
    </Stack>
  );

  const tabContent: Record<string, ReactNode> = {
    theme: (
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
                  <Typography variant="subtitle2" sx={{ ml: "auto", fontFamily: CORE_FONTS.find((f) => f.id === p.font)?.family, color: s.roles.text.main }}>Aa</Typography>
                </Box>
              </ChoiceTile>
            );
          })}
        </Box>
      </Section>

        {modeTiles}
      </Stack>
    ),
    style: (
      <Stack spacing={3.5} divider={<Divider flexItem />}>
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

      </Stack>
    ),
    background: (
      <Stack spacing={3.5} divider={<Divider flexItem />}>
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

        {effectTiles}
      </Stack>
    ),
    text: textTab,
    dashboards: dashboardsTab,
  };

  const settings = (
    <Box sx={{ minWidth: 0 }}>
      <Tabs
        value={tab}
        onChange={(_, v: string) => {
          setTab(v);
          writeStored(TAB_KEY, v);
        }}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="Appearance"
        sx={{ mb: 3 }}
      >
        {TABS.map((t) => (
          <Tab key={t.id} value={t.id} label={t.label} sx={{ minWidth: 0, px: 1.75 }} />
        ))}
      </Tabs>
      {tabContent[tab] ?? tabContent.theme}
      {footnote ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 3 }}>
          {footnote}
        </Typography>
      ) : null}
    </Box>
  );

  // Wide screens: settings on the left, the preview beside them staying in view; else preview first.
  return wide ? (
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(360px, 0.8fr)", gap: 3, alignItems: "start" }}>
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
