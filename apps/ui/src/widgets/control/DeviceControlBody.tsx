import AcUnitRoundedIcon from "@mui/icons-material/AcUnitRounded";
import AirRoundedIcon from "@mui/icons-material/AirRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import WaterDropRoundedIcon from "@mui/icons-material/WaterDropRounded";
import WbSunnyRoundedIcon from "@mui/icons-material/WbSunnyRounded";
import { Box, Button, ButtonBase, Dialog, Slider, Switch, Typography, useTheme } from "@mui/material";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ColourWheel } from "./ColourWheel";
import { TemperatureDial } from "./TemperatureDial";
import { FAN_STEPS, WHITE_LIGHT, colorCss, deviceColour, fanWord, isWhiteLight, splitTemperature, type ControlState } from "./control-view";
import { CONTROL_TEXT, VALUE_WEIGHT } from "../../lib/appearance/type";
import { choiceSx } from "../../skins/surfaceStyles";
import { BLIND_SLATS, BLIND_VIEW, CONTROL_LINE_DESIGN, CTRL, controlFitsOneLine, controlScale } from "./control-style";
import { useDeviceControl } from "./useDeviceControl";

type Cap = Parameters<typeof useDeviceControl>[0] & { kind: string; name: string };
type Ctl = ReturnType<typeof useDeviceControl>;
type View = { cap: Cap; ctl: Ctl };

const MODE_ICON: Record<string, ReactNode> = {
  auto: <AutorenewRoundedIcon fontSize="small" />,
  cool: <AcUnitRoundedIcon fontSize="small" />,
  heat: <WbSunnyRoundedIcon fontSize="small" />,
  dry: <WaterDropRoundedIcon fontSize="small" />,
  fan: <AirRoundedIcon fontSize="small" />,
};
const WORD: Record<string, string> = {
  auto: "Auto", cool: "Cool", heat: "Heat", dry: "Dry", fan: "Fan",
  low: "Low", medium: "Med", high: "High",
};
const COLOURS = [["Amber", 28], ["Red", 0], ["Green", 130], ["Ocean", 190], ["Blue", 228], ["Violet", 285]] as const;

function usesOn(kind: string) {
  return kind !== "cover";
}
function isOn(kind: string, state: ControlState) {
  return kind === "cover" ? (state.position ?? 0) > 0 : state.on !== false;
}
/** The switch: on and off, or for blinds fully open and closed. */
function toggle(cap: Cap, ctl: Ctl) {
  if (usesOn(cap.kind)) void ctl.change({ on: !isOn(cap.kind, ctl.state) });
  else void ctl.change({ position: isOn(cap.kind, ctl.state) ? 0 : 100 });
}

function Toggle({ cap, ctl }: View) {
  return (
    <Switch
      checked={isOn(cap.kind, ctl.state)}
      onChange={() => toggle(cap, ctl)}
      inputProps={{ "aria-label": `${cap.name} on or off` }}
      sx={{
        "& .MuiSwitch-switchBase.Mui-checked": { color: "var(--c)" },
        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "var(--c)", opacity: 0.6 },
      }}
    />
  );
}

function Choice({ pressed, onClick, tall, wide, children }: { pressed: boolean; onClick: () => void; tall?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <ButtonBase
      aria-pressed={pressed}
      onClick={onClick}
      sx={[
        choiceSx(pressed, { radius: "field" }),
        {
          flex: wide ? 1.5 : 1,
          minWidth: 0,
          display: "flex",
          flexDirection: tall ? "column" : "row",
          gap: "3px",
          px: "2px",
          color: pressed ? "text.primary" : "text.secondary",
          fontSize: CONTROL_TEXT.row,
          fontWeight: "fontWeightBold",
          whiteSpace: "nowrap",
        },
        pressed ? { borderColor: "var(--c)", bgcolor: "color-mix(in srgb, var(--c) 24%, transparent)" } : {},
      ]}
    >
      {children}
    </ButtonBase>
  );
}

function Row({ tall, children, label }: { tall?: boolean; children: ReactNode; label?: string }) {
  return (
    <Box role={label ? "group" : undefined} aria-label={label} sx={{ flex: "none", height: tall ? CTRL.rowTall : CTRL.rowLow, display: "flex", gap: "6px", alignItems: "stretch" }}>
      {children}
    </Box>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", borderRadius: 1, bgcolor: CTRL.raised }}>
      <Typography component="b" noWrap sx={{ fontSize: CONTROL_TEXT.stat, fontWeight: "fontWeightBold", lineHeight: 1.1, fontVariantNumeric: "tabular-nums", maxWidth: "100%" }}>{value}</Typography>
      <Typography component="span" variant="caption" noWrap sx={{ color: "text.secondary" }}>{label}</Typography>
    </Box>
  );
}

function LevelRow({ label, shown, value, min, enabled, onDrag, onCommit }: { label: string; shown: string; value: number; min: number; enabled: boolean; onDrag: (v: number | null) => void; onCommit: (v: number) => void }) {
  return (
    <Row tall>
      <Box sx={{ width: "100%", px: "4px", display: "grid", gridTemplateColumns: "1fr auto", alignContent: "center" }}>
        <Box sx={{ fontSize: CONTROL_TEXT.row, fontWeight: "fontWeightBold", color: "text.secondary" }}>{label}</Box>
        <Box sx={{ fontSize: CONTROL_TEXT.rowValue, fontWeight: "fontWeightBold", fontVariantNumeric: "tabular-nums" }}>{shown}</Box>
        <Slider
          aria-label={label}
          min={min}
          max={100}
          value={value}
          disabled={!enabled}
          onChange={(_, v) => onDrag(v as number)}
          onChangeCommitted={(_, v) => {
            onDrag(null);
            onCommit(v as number);
          }}
          sx={{
            gridColumn: "1 / 3",
            color: "var(--c)",
            height: 8,
            py: "11px",
            "& .MuiSlider-rail": { bgcolor: "currentColor", opacity: 0.25 },
            "& .MuiSlider-track": { border: 0 },
            "& .MuiSlider-thumb": { width: 26, height: 26, bgcolor: "var(--nx-ctrl-hole)", border: "4px solid currentColor" },
          }}
        />
      </Box>
    </Row>
  );
}

/** One build for every device: the main picture, then its rows. The switch is always top right. */
function Panel({ cap, ctl, colour, stage, children }: View & { colour: string; stage: ReactNode; children?: ReactNode }) {
  const theme = useTheme();
  const off = !isOn(cap.kind, ctl.state) && usesOn(cap.kind);
  return (
    <Box
      data-control={cap.kind}
      sx={{ position: "relative", width: "100%", height: "100%", minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", p: 1, color: "text.primary", overflow: "hidden" }}
      style={{ "--c": colour, "--nx-ctrl-hole": theme.palette.background.paper } as CSSProperties}
    >
      <Box sx={{ position: "absolute", top: 4, right: 4, zIndex: 2 }}>
        <Toggle cap={cap} ctl={ctl} />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: CTRL.gap, opacity: off ? 0.34 : 1, pointerEvents: off ? "none" : undefined, transition: "opacity .2s" }}>
        <Box sx={{ position: "relative", flex: 1, minHeight: 0, containerType: "size", display: "grid", placeItems: "center", overflow: "hidden", borderRadius: 1 }}>
          {stage}
        </Box>
        {children}
      </Box>
      {ctl.error ? (
        <Typography variant="caption" color="error" role="status" textAlign="center" sx={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 3, px: 1, py: 0.5, bgcolor: "background.paper", fontWeight: "fontWeightBold" }}>
          {ctl.error}
        </Typography>
      ) : null}
    </Box>
  );
}

function StepButton({ side, label, disabled, onClick }: { side: "left" | "right"; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <Button
      variant="outlined"
      color="inherit"
      disabled={disabled}
      aria-label={label}
      onClick={onClick}
      sx={{ position: "absolute", bottom: 0, [side]: 0, zIndex: 1, minWidth: 0, minHeight: 0, width: 40, height: 40, p: 0, fontSize: CONTROL_TEXT.stepSign, lineHeight: 1 }}
    >
      {side === "left" ? "−" : "+"}
    </Button>
  );
}

function Temperature(view: View) {
  const { cap, ctl } = view;
  const theme = useTheme();
  const { state, features, change } = ctl;
  const climate = cap.kind === "climate";
  const min = features.min ?? (climate ? 16 : 10);
  const max = features.max ?? 30;
  const step = features.step ?? (climate ? 1 : 0.5);
  const on = state.on !== false;
  const noTemperature = climate && state.mode === "fan";
  const bump = (d: -1 | 1) => {
    if (state.target !== undefined) void change({ target: Math.min(max, Math.max(min, state.target + d * step)) });
  };
  const stats = [
    state.heating !== undefined ? <Stat key="now" value={state.heating ? "Heating" : "Idle"} label="Right now" /> : null,
    state.humidity !== undefined ? <Stat key="hum" value={`${state.humidity}%`} label="Humidity" /> : null,
    state.outside !== undefined ? <Stat key="out" value={`${state.outside}°`} label="Outside" /> : null,
  ].filter(Boolean);
  return (
    <Panel
      {...view}
      colour={deviceColour(cap.kind, state, features, theme.palette.primary.main)}
      stage={
        <>
          <TemperatureDial value={state.target} current={state.current} min={min} max={max} step={step} enabled={on} word={noTemperature ? "Fan" : undefined} onCommit={(target) => void change({ target })} />
          <StepButton side="left" label="Lower the set temperature" disabled={!on || noTemperature} onClick={() => bump(-1)} />
          <StepButton side="right" label="Raise the set temperature" disabled={!on || noTemperature} onClick={() => bump(1)} />
        </>
      }
    >
      {stats.length ? <Row tall>{stats}</Row> : null}
      {features.presets?.length ? (
        <Row label="Setting">
          {features.presets.map((p) => <Choice key={p} pressed={state.preset === p} onClick={() => void change({ preset: p })}>{p}</Choice>)}
        </Row>
      ) : null}
      {climate && features.modes?.length ? (
        <Row tall label="Mode">
          {features.modes.map((m) => <Choice key={m} tall pressed={state.mode === m} onClick={() => void change({ mode: m })}>{MODE_ICON[m]}{WORD[m] ?? m}</Choice>)}
        </Row>
      ) : null}
      {climate && features.fanSpeeds?.length ? (
        <Row label="Fan speed">
          {features.fanSpeeds.map((f) => <Choice key={f} wide={f === "auto"} pressed={state.fan === f} onClick={() => void change({ fan: f })}>{f === "auto" ? "Fan Auto" : WORD[f] ?? f}</Choice>)}
        </Row>
      ) : null}
    </Panel>
  );
}

const SCENE_CONE = "polygon(44% 0, 56% 0, 100% 100%, 0 100%)";

function CeilingScene({ level, label }: { level: number; label: string }) {
  return (
    <>
      <Box aria-hidden sx={{ position: "absolute", left: "50%", top: "22cqmin", width: "130cqmin", height: "calc(100% - 22cqmin)", ml: "-65cqmin", clipPath: SCENE_CONE, background: "linear-gradient(180deg, rgba(255,206,120,.85), rgba(255,206,120,0) 92%)", opacity: level / 100, pointerEvents: "none" }} />
      <Box component="svg" aria-hidden viewBox="0 0 64 50" sx={{ position: "absolute", left: "50%", top: 0, width: "30cqmin", height: "24cqmin", ml: "-15cqmin" }}>
        <path d="M31 0h2v22h-2z" fill="#6a6b71" />
        <path d="M14 46c0-14 8-24 18-24s18 10 18 24Z" fill="#3a3b40" />
        <ellipse cx="32" cy="46" rx="11" ry="4" fill="#ffd98f" style={{ opacity: 0.25 + level / 133 }} />
      </Box>
      <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: "2px", pb: "4cqmin", pointerEvents: "none" }}>
        <Box sx={{ ...CTRL.caption, color: "text.primary" }}>{label}</Box>
        <Box sx={CTRL.big}>{label === "Brightness" ? `${level}%` : ""}</Box>
      </Box>
    </>
  );
}

function Light(view: View) {
  const { cap, ctl } = view;
  const theme = useTheme();
  const { state, features, change } = ctl;
  const [dragHue, setDragHue] = useState<number | null>(null);
  const [dragLevel, setDragLevel] = useState<number | null>(null);
  const on = state.on !== false;
  const shownState: ControlState = dragHue !== null ? { ...state, white: false, color: { h: dragHue, s: 1 } } : state;
  const level = dragLevel ?? state.brightness ?? 100;
  const white = isWhiteLight(shownState);
  const setColour = (h: number) => void change({ color: { h, s: 1 } });
  const setWhite = () => void change(features.white ? { white: true } : { color: { h: 0, s: 0 } });
  return (
    <Panel
      {...view}
      colour={deviceColour(cap.kind, shownState, features, theme.palette.primary.main)}
      stage={
        features.color ? (
          <ColourWheel
            hue={white ? undefined : shownState.color?.h}
            disabled={!on}
            glow={level / 100}
            onChange={setDragHue}
            onCommit={(h) => {
              setDragHue(null);
              setColour(h);
            }}
          >
            <Box sx={CTRL.caption}>Brightness</Box>
            <Box sx={{ ...CTRL.big, fontSize: CONTROL_TEXT.picture }}>{level}%</Box>
          </ColourWheel>
        ) : (
          <CeilingScene level={features.brightness ? level : 100} label={features.brightness ? "Brightness" : on ? "On" : "Off"} />
        )
      }
    >
      {features.brightness ? <LevelRow label="Brightness" shown={`${level}%`} value={level} min={1} enabled={on} onDrag={setDragLevel} onCommit={(brightness) => void change({ brightness })} /> : null}
      {features.color ? (
        <Row label="Colours">
          {COLOURS.map(([name, h]) => (
            <ColourDot key={name} name={name} colour={colorCss({ h, s: 1 })} pressed={!white && state.color !== undefined && Math.abs(state.color.h - h) < 1} onClick={() => setColour(h)} />
          ))}
          <ColourDot name="White" colour={WHITE_LIGHT} pressed={white} onClick={setWhite} />
        </Row>
      ) : !features.color && features.brightness ? (
        <Row label="Brightness settings">
          {([["Night", 10], ["Relax", 40], ["Full", 100]] as const).map(([name, b]) => <Choice key={name} pressed={state.brightness === b} onClick={() => void change({ brightness: b })}>{name}</Choice>)}
        </Row>
      ) : null}
    </Panel>
  );
}

function ColourDot({ name, colour, pressed, onClick }: { name: string; colour: string; pressed: boolean; onClick: () => void }) {
  return <ButtonBase aria-label={name} aria-pressed={pressed} onClick={onClick} sx={{ flex: 1, minWidth: 0, borderRadius: 1, outline: pressed ? 2 : 0, outlineColor: "text.primary", outlineOffset: "1px" }} style={{ backgroundColor: colour }} />;
}

function Blinds(view: View) {
  const { cap, ctl } = view;
  const theme = useTheme();
  const { state, features, change } = ctl;
  const [drag, setDrag] = useState<number | null>(null);
  const open = drag ?? state.position ?? 0;
  return (
    <Panel
      {...view}
      colour={deviceColour(cap.kind, state, features, theme.palette.primary.main)}
      stage={
        <Box sx={{ display: "flex", alignItems: "center", gap: "6cqmin" }}>
          <Box aria-hidden sx={{ position: "relative", width: "46cqmin", height: "72cqmin", borderRadius: 1, overflow: "hidden", background: BLIND_VIEW }}>
            <Box sx={{ position: "absolute", inset: "0 0 auto 0", background: BLIND_SLATS, transition: "height .25s" }} style={{ height: `${100 - open}%` }} />
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <Box sx={CTRL.caption}>Open</Box>
            <Box sx={{ ...CTRL.big, fontSize: CONTROL_TEXT.pictureBeside }}>{open}%</Box>
          </Box>
        </Box>
      }
    >
      <LevelRow label="Open" shown={`${open}%`} value={open} min={0} enabled onDrag={setDrag} onCommit={(position) => void change({ position })} />
      <Row label="Blinds position">
        {([["Close", 0], ["Half", 50], ["Open", 100]] as const).map(([name, p]) => <Choice key={name} pressed={state.position === p} onClick={() => void change({ position: p })}>{name}</Choice>)}
      </Row>
    </Panel>
  );
}

function Fan(view: View) {
  const { cap, ctl } = view;
  const theme = useTheme();
  const { state, features, change } = ctl;
  const [drag, setDrag] = useState<number | null>(null);
  const on = state.on !== false;
  const speed = drag ?? state.speed ?? 50;
  return (
    <Panel
      {...view}
      colour={deviceColour(cap.kind, state, features, theme.palette.primary.main)}
      stage={
        <>
          <Box
            aria-hidden
            sx={{ width: "64cqmin", height: "64cqmin", color: "var(--c)", animation: "nx-fan 1s linear infinite", "@keyframes nx-fan": { to: { transform: "rotate(360deg)" } }, "@media (prefers-reduced-motion: reduce)": { animation: "none" } }}
            style={{ animationDuration: `${2.2 - speed / 55}s`, animationPlayState: on ? "running" : "paused" }}
          >
            <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", fill: "currentColor" }}>
              <path d="M50 42C44 22 48 6 60 6s16 18-4 37ZM58 50c20-6 36-2 36 10s-18 16-37-4ZM50 58c6 20 2 36-10 36s-16-18 4-37ZM42 50C22 56 6 52 6 40s18-16 37 4Z" />
              <circle cx="50" cy="50" r="7" />
            </svg>
          </Box>
          <Box sx={{ position: "absolute", right: 8, bottom: 4, textAlign: "right" }}>
            <Box sx={CTRL.caption}>Speed</Box>
            <Box sx={{ ...CTRL.big, fontSize: CONTROL_TEXT.pictureSide, fontWeight: "fontWeightMedium" }}>{fanWord(speed)}</Box>
          </Box>
        </>
      }
    >
      <LevelRow label="Speed" shown={`${speed}%`} value={speed} min={1} enabled={on} onDrag={setDrag} onCommit={(s) => void change({ speed: s })} />
      <Row label="Speed settings">
        {FAN_STEPS.map(([name, s]) => <Choice key={name} pressed={fanWord(state.speed) === name} onClick={() => void change({ speed: s })}>{name}</Choice>)}
      </Row>
    </Panel>
  );
}

function Device(view: View) {
  const kind = view.cap.kind;
  if (kind === "light") return <Light {...view} />;
  if (kind === "cover") return <Blinds {...view} />;
  if (kind === "fan") return <Fan {...view} />;
  return <Temperature {...view} />;
}

/** The set temperature: the whole degrees never move, ° and .5 have fixed places beside them. */
function LineTemperature({ value }: { value: number }) {
  const { whole, half } = splitTemperature(value);
  return (
    <Box sx={{ display: "flex", alignItems: "stretch", color: "var(--c)", fontVariantNumeric: "tabular-nums", fontWeight: VALUE_WEIGHT }}>
      <Box component="span" sx={{ fontSize: CONTROL_TEXT.lineTemperature, lineHeight: 1.1 }}>{whole}</Box>
      <Box component="span" sx={{ width: "1.7em", pl: "2px", display: "flex", flexDirection: "column", justifyContent: "space-between", py: "2px", fontSize: CONTROL_TEXT.lineTemperatureSide, lineHeight: 1 }}>
        <span>°</span>
        <span>{half}</span>
      </Box>
    </Box>
  );
}

function LineStep({ sign, label, disabled, onClick }: { sign: string; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <Button variant="outlined" color="inherit" disabled={disabled} aria-label={label} onClick={onClick} sx={{ flex: "none", minWidth: 0, minHeight: 0, width: 32, height: 32, p: 0, fontSize: CONTROL_TEXT.stepSign, lineHeight: 1 }}>
      {sign}
    </Button>
  );
}

/** What a one-line panel names and shows for a device that has a level to drag. */
function lineLevel(kind: string, state: ControlState): { label: string; value: number; min: number; key: keyof ControlState } {
  if (kind === "cover") return { label: "Open", value: state.position ?? 0, min: 0, key: "position" };
  if (kind === "fan") return { label: "Speed", value: state.speed ?? 50, min: 1, key: "speed" };
  return { label: "Brightness", value: state.brightness ?? 100, min: 1, key: "brightness" };
}

function LineMiddle({ cap, ctl }: View) {
  const { state, features, change } = ctl;
  const [drag, setDrag] = useState<number | null>(null);
  const temperature = cap.kind === "thermostat" || cap.kind === "climate";
  const on = state.on !== false;
  const big = (text: string, label: string) => (
    <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "6px", minWidth: 0, whiteSpace: "nowrap" }}>
      <Box component="span" sx={{ fontSize: CONTROL_TEXT.row, fontWeight: "fontWeightBold", color: "text.secondary" }}>{label}</Box>
      <Box component="span" sx={{ fontSize: CONTROL_TEXT.line, fontWeight: VALUE_WEIGHT, color: "var(--c)", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>{text}</Box>
    </Box>
  );

  if (temperature) {
    const climate = cap.kind === "climate";
    const noTemperature = climate && state.mode === "fan";
    const min = features.min ?? (climate ? 16 : 10);
    const max = features.max ?? 30;
    const step = features.step ?? (climate ? 1 : 0.5);
    const bump = (d: -1 | 1) => {
      if (state.target !== undefined) void change({ target: Math.min(max, Math.max(min, state.target + d * step)) });
    };
    const mode = climate && state.mode ? WORD[state.mode] ?? state.mode : "";
    return (
      <Box sx={{ mt: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <LineStep sign="−" label="Lower the set temperature" disabled={!on || noTemperature} onClick={() => bump(-1)} />
          {noTemperature || state.target === undefined ? (
            big(noTemperature ? "Fan" : "—", noTemperature ? "Mode" : "Set to")
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Box component="span" sx={{ fontSize: CONTROL_TEXT.row, fontWeight: "fontWeightBold", color: "text.secondary", whiteSpace: "nowrap" }}>Set to</Box>
              <LineTemperature value={state.target} />
            </Box>
          )}
          <LineStep sign="+" label="Raise the set temperature" disabled={!on || noTemperature} onClick={() => bump(1)} />
        </Box>
        {state.current !== undefined ? (
          <Box sx={{ display: "flex", justifyContent: "center", gap: "4px", fontSize: CONTROL_TEXT.row, fontWeight: "fontWeightBold", color: "text.secondary", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
            {mode ? <Box component="span" sx={{ width: "3.6em", textAlign: "right" }}>{mode} ·</Box> : null}
            <span>Currently</span>
            <Box component="span" sx={{ width: "3em", textAlign: "left" }}>{state.current}°</Box>
          </Box>
        ) : null}
      </Box>
    );
  }

  if (cap.kind === "light" && !features.brightness) return big(on ? "On" : "Off", "Light");

  const level = lineLevel(cap.kind, state);
  const shown = drag ?? level.value;
  return (
    <>
      {big(cap.kind === "fan" ? fanWord(shown) : `${shown}%`, level.label)}
      <Slider
        aria-label={level.label}
        min={level.min}
        max={100}
        value={shown}
        disabled={cap.kind !== "cover" && !on}
        onChange={(_, v) => setDrag(v as number)}
        onChangeCommitted={(_, v) => {
          setDrag(null);
          void change({ [level.key]: v as number });
        }}
        sx={{
          display: "block",
          color: "var(--c)",
          height: 6,
          py: "7px",
          "& .MuiSlider-rail": { bgcolor: "currentColor", opacity: 0.25 },
          "& .MuiSlider-track": { border: 0 },
          "& .MuiSlider-thumb": { width: 18, height: 18, bgcolor: "var(--nx-ctrl-hole)", border: "3px solid currentColor" },
        }}
      />
    </>
  );
}

/** The smallest panel: what it is and its value in the middle, the full panel on the left and the switch on the right. */
function LineTile({ cap, ctl, onOpen }: View & { onOpen: () => void }) {
  const theme = useTheme();
  const { state, features } = ctl;
  const off = !isOn(cap.kind, state) && usesOn(cap.kind);
  return (
    <Box
      data-control={cap.kind}
      sx={{ position: "relative", width: "100%", height: "100%", minHeight: 0, display: "grid", gridTemplateColumns: "30px minmax(0, 1fr) 56px", alignItems: "center", gap: "8px", px: "4px", color: "text.primary" }}
      style={{ "--c": deviceColour(cap.kind, state, features, theme.palette.primary.main), "--nx-ctrl-hole": theme.palette.background.paper } as CSSProperties}
    >
      <Button variant="outlined" color="inherit" aria-label={`Open ${cap.name}`} onClick={onOpen} sx={{ position: "absolute", top: 10, left: 10, zIndex: 1, minWidth: 0, minHeight: 0, width: 26, height: 26, p: 0 }}>
        <TuneRoundedIcon fontSize="small" />
      </Button>
      <Box sx={{ gridColumn: 2, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: "8px", opacity: off ? 0.34 : 1, pointerEvents: off ? "none" : undefined }}>
        {ctl.error ? <Typography variant="caption" color="error" role="status" textAlign="center" sx={{ fontWeight: "fontWeightBold" }}>No answer</Typography> : null}
        <LineMiddle cap={cap} ctl={ctl} />
      </Box>
      <Box sx={{ justifySelf: "end" }}>
        <Switch
          size="small"
          checked={isOn(cap.kind, state)}
          onChange={() => toggle(cap, ctl)}
          inputProps={{ "aria-label": `${cap.name} on or off` }}
          sx={{
            "& .MuiSwitch-switchBase.Mui-checked": { color: "var(--c)" },
            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "var(--c)", opacity: 0.6 },
          }}
        />
      </Box>
    </Box>
  );
}

/** The whole control at its design size, shrunk or grown as one to fill the room it has. */
function Scaled({ width, height, design, children }: { width: number; height: number; design?: { width: number; height: number }; children: ReactNode }) {
  const scale = controlScale(width, height, design);
  return <Box sx={{ transformOrigin: "top left" }} style={{ width: width / scale, height: height / scale, transform: `scale(${scale})` }}>{children}</Box>;
}

/** The panel content for any device control: only what this device can do, all of it at any panel size. */
export function DeviceControlBody({ cap }: { cap: Cap }) {
  const ctl = useDeviceControl(cap);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const seen = new ResizeObserver(measure);
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  const ready = size !== null && size.width > 0 && size.height > 0;
  return (
    <Box ref={box} sx={{ flex: 1, width: "100%", height: "100%", minHeight: 0, minWidth: 0, overflow: "hidden" }}>
      {!ready ? null : controlFitsOneLine(size.width, size.height) ? (
        <Scaled width={size.width} height={size.height} design={CONTROL_LINE_DESIGN}><LineTile cap={cap} ctl={ctl} onOpen={() => setOpen(true)} /></Scaled>
      ) : (
        <Scaled width={size.width} height={size.height}><Device cap={cap} ctl={ctl} /></Scaled>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} aria-label={cap.name} PaperProps={{ sx: { width: "min(360px, 100%)", m: 2, display: "flex", flexDirection: "column" } }}>
        <Typography variant="h6" noWrap sx={{ px: 2, pt: 1.5 }}>{cap.name}</Typography>
        <Box sx={{ height: 420 }}>
          <Scaled width={340} height={420}><Device cap={cap} ctl={ctl} /></Scaled>
        </Box>
        <Button color="inherit" variant="outlined" onClick={() => setOpen(false)} sx={{ m: 1, mt: 0, height: 44 }}>Done</Button>
      </Dialog>
    </Box>
  );
}
