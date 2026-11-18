import { useEffect, useState } from "react";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import PhoneAndroidRoundedIcon from "@mui/icons-material/PhoneAndroidRounded";
import { Link as RouterLink } from "react-router-dom";

/**
 * The App: Nexternel installed on a phone or tablet (Nexternel for Android today). The app offers
 * window.NexternelPhone; everything the app itself controls lives on one page, App settings
 * (pages/AppSettingsPage.tsx), opened from the bottom of the menu. Nothing here shows on a computer.
 */
export type AppUpdateState = { current?: string; latest?: string | null; checked?: boolean; failed?: boolean; checking?: boolean };
export type AppBridge = {
  updateState(): string;
  checkForUpdate(): void;
  installUpdate(): void;
  changeHome?: () => void;
  keepScreenOn?: () => boolean;
  setKeepScreenOn?: (on: boolean) => void;
};

export const APP_SETTINGS_PATH = "/app-settings";

export function appBridge(): AppBridge | null {
  const p = (window as unknown as { NexternelPhone?: Partial<AppBridge> }).NexternelPhone;
  return p && typeof p.checkForUpdate === "function" && typeof p.updateState === "function" && typeof p.installUpdate === "function"
    ? (p as AppBridge)
    : null;
}

/** Inside the App (the frame offers window.NexternelPhone). */
export function inPhoneFrame(): boolean {
  return appBridge() !== null;
}

function readState(p: AppBridge): AppUpdateState {
  try {
    return JSON.parse(p.updateState()) as AppUpdateState;
  } catch {
    return {};
  }
}

/** The App's version and what its last update check found; follows the frame's "nexternel-phone-update" answers. */
export function useAppUpdate() {
  const p = appBridge();
  const [state, setState] = useState<AppUpdateState>(() => (p ? readState(p) : {}));
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (!p) return;
    const onAnswer = (e: Event) => {
      setState((e as CustomEvent<AppUpdateState>).detail ?? {});
      setChecking(false);
    };
    window.addEventListener("nexternel-phone-update", onAnswer);
    return () => window.removeEventListener("nexternel-phone-update", onAnswer);
  }, [p]);
  return {
    bridge: p,
    state,
    busy: checking || Boolean(state.checking),
    check: () => {
      if (!p) return;
      setChecking(true);
      p.checkForUpdate();
    },
  };
}

/**
 * "App settings" at the bottom of the menu (only inside the App), with a dot when an update is
 * ready, so it is not hidden on the page. `iconOnly` for the folded side menu.
 */
export function AppSettingsButton({ iconOnly = false, onNavigate }: { iconOnly?: boolean; onNavigate?: () => void }) {
  const { bridge, state } = useAppUpdate();
  if (!bridge) return null;
  const ready = Boolean(state.latest);
  const icon = (
    <Badge color="primary" variant="dot" invisible={!ready} overlap="circular">
      <PhoneAndroidRoundedIcon fontSize="small" />
    </Badge>
  );
  const label = ready ? "App settings, an update is ready" : "App settings";
  if (iconOnly) {
    return (
      <Tooltip title={label} placement="right">
        <Button component={RouterLink} to={APP_SETTINGS_PATH} onClick={onNavigate} variant="outlined" size="small" aria-label={label} sx={{ minWidth: 40, px: 1 }}>
          {icon}
        </Button>
      </Tooltip>
    );
  }
  return (
    <Button component={RouterLink} to={APP_SETTINGS_PATH} onClick={onNavigate} variant="outlined" startIcon={icon} aria-label={label} fullWidth sx={{ justifyContent: "flex-start" }}>
      App settings
    </Button>
  );
}
