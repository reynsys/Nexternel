import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ThemeProvider, CssBaseline, GlobalStyles } from "@mui/material";
import { createTheme } from "@mui/material/styles";
import { api, getStoredAccessToken, type UserThemePrefs } from "../api";
import type { UiSkin } from "./types";
import { getActiveSkinId, setActiveSkinId } from "./activeSkin";
import { getSkin, listSkins } from "./registry";
import { gradientBaseColour, gradientCss } from "./gradientPalettes";
import {
  getThemePrefs,
  setThemePrefs as persistThemePrefsLocal,
  toAccountThemePrefs,
  normalizeThemePrefs,
  type ThemePrefs,
  DEFAULT_THEME_PREFS,
} from "./themePrefs";
import { AppearanceCssVars } from "./AppearanceCssVars";
import { MOTION_CSS } from "../lib/motion";
import { BackgroundEffects } from "./effects/BackgroundEffects";
import { looksVersion, resolveLook, subscribeLooks } from "./looks/registry";
import { resolveTokens } from "./looks/resolve";
import { lookThemeOptions } from "./look-theme";
import { isGradientActive } from "./surfaceStyles";
import { loadAddons } from "./looks/addon-loader";
import { useLiveChanges } from "../lib/live-changes";
import { LIGHT_CSS, useDisplayMode } from "../lib/display-mode";

type SkinContextValue = {
  skin: UiSkin;
  skins: UiSkin[];
  setSkinId: (id: string) => void;
  themePrefs: ThemePrefs;
  setThemePrefs: (prefs: ThemePrefs | ((prev: ThemePrefs) => ThemePrefs)) => void;
  /** Apply prefs from the signed-in user account (login / me). */
  applyAccountPrefs: (prefs: UserThemePrefs | null | undefined) => void;
  /** Changes when an add-on adds a Look, so pickers and panels re-draw. */
  looksVersion: number;
};

const SkinContext = createContext<SkinContextValue | null>(null);

export function SkinProvider({ children }: { children: ReactNode }) {
  const [skinId, setSkinIdState] = useState(() => getActiveSkinId());
  const [themePrefs, setThemePrefsState] = useState<ThemePrefs>(() => getThemePrefs());
  const skins = useMemo(() => listSkins(), []);
  const skin = useMemo(() => getSkin(skinId), [skinId]);
  const lookVer = useSyncExternalStore(subscribeLooks, looksVersion, looksVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- lookVer: a Look from an add-on may arrive later
  const look = useMemo(() => resolveLook(themePrefs.lookId), [themePrefs.lookId, lookVer]);
  // A Look that only works in one colour mode (HUD) shows in that mode; the saved choice is kept.
  const shownPrefs = useMemo(
    () => (look.forceMode && look.forceMode !== themePrefs.mode ? { ...themePrefs, mode: look.forceMode } : themePrefs),
    [look, themePrefs]
  );
  const theme = useMemo(() => {
    // The skin gives the layout's colours; the Look styles every building block from its roles.
    const base = skin.createTheme(shownPrefs);
    const tokens = resolveTokens(look, base, shownPrefs.lookFont);
    return createTheme(
      base,
      lookThemeOptions(base, tokens, {
        gradientActive: isGradientActive(shownPrefs),
        solidContentPanels: Boolean(shownPrefs.solidContentPanels),
      })
    );
  }, [skin, shownPrefs, look]);
  // Text size: all text is measured in rem, so the page's base size scales it everywhere.
  const display = useDisplayMode();
  useEffect(() => {
    document.documentElement.style.fontSize = `${display.active ? display.textSize : (themePrefs.textSize ?? 100)}%`;
  }, [themePrefs.textSize, display.active, display.textSize]);
  // Animations: the person's choice, and off when the device asks apps to reduce motion.
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.documentElement.setAttribute("data-nx-motion", themePrefs.motion !== false && !reduce ? "on" : "off");
  }, [themePrefs.motion]);
  const persistServerRef = useRef(true);
  const hydratedRef = useRef(false);

  const pushAccountPrefs = useCallback(
    (prefs: ThemePrefs, nextSkinId: string) => {
      if (!getStoredAccessToken()) return;
      const body = {
        themePrefs: toAccountThemePrefs(prefs, nextSkinId),
      };
      void api.patchMe(body).catch(() => {
        /* keep local prefs if save fails */
      });
    },
    []
  );

  const applyAccountPrefs = useCallback((prefs: UserThemePrefs | null | undefined) => {
    if (!prefs) return;
    persistServerRef.current = false;
    const next = normalizeThemePrefs(prefs);
    const nextSkin = prefs.skinId?.trim() || next.skinId || getActiveSkinId();
    persistThemePrefsLocal(next);
    setThemePrefsState(next);
    setActiveSkinId(nextSkin);
    setSkinIdState(nextSkin);
    queueMicrotask(() => {
      persistServerRef.current = true;
    });
    void loadAddons();
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    if (!getStoredAccessToken()) return;
    hydratedRef.current = true;
    void api
      .me()
      .then((r) => applyAccountPrefs(r.user.themePrefs))
      .catch(() => {
        /* stay on local prefs */
      });
  }, [applyAccountPrefs]);

  // Appearance changed on another screen (or by an admin), or an add-on was updated: show it here.
  useLiveChanges(["me", "users", "addons"], (topic) => {
    if (topic === "addons") {
      void loadAddons();
      return;
    }
    if (!getStoredAccessToken()) return;
    void api
      .me()
      .then((r) => applyAccountPrefs(r.user.themePrefs))
      .catch(() => {
        /* keep what is shown */
      });
  });

  const setSkinId = useCallback(
    (id: string) => {
      setActiveSkinId(id);
      setSkinIdState(id);
      setThemePrefsState((prev) => {
        const next = { ...prev, skinId: id };
        persistThemePrefsLocal(next);
        if (persistServerRef.current) {
          pushAccountPrefs(next, id);
        }
        return next;
      });
    },
    [pushAccountPrefs]
  );

  const setThemePrefs = useCallback(
    (prefs: ThemePrefs | ((prev: ThemePrefs) => ThemePrefs)) => {
      setThemePrefsState((prev) => {
        const next = typeof prefs === "function" ? prefs(prev) : prefs;
        persistThemePrefsLocal(next);
        if (persistServerRef.current) {
          pushAccountPrefs(next, next.skinId ?? skinId);
        }
        return next;
      });
    },
    [pushAccountPrefs, skinId]
  );

  // With a plain background, a Look may bring its own (e.g. the HUD's grid).
  const lookBackground = useMemo(
    () => (!gradientCss(shownPrefs.gradientId) && look.background ? look.background(shownPrefs.mode) : null),
    [look, shownPrefs.gradientId, shownPrefs.mode]
  );
  const pageGradient = useMemo(
    () => gradientCss(shownPrefs.gradientId, shownPrefs.mode) ?? lookBackground?.image ?? null,
    [shownPrefs.gradientId, shownPrefs.mode, lookBackground]
  );
  const pageBaseColour = useMemo(
    () => gradientBaseColour(shownPrefs.gradientId, shownPrefs.mode) ?? lookBackground?.colour ?? null,
    [shownPrefs.gradientId, shownPrefs.mode, lookBackground]
  );

  const value = useMemo(
    () => ({
      skin,
      skins,
      setSkinId,
      themePrefs,
      setThemePrefs,
      applyAccountPrefs,
      looksVersion: lookVer,
    }),
    [skin, skins, setSkinId, themePrefs, setThemePrefs, applyAccountPrefs, lookVer]
  );

  return (
    <SkinContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppearanceCssVars lookId={themePrefs.lookId} buttonsId={themePrefs.lookButtons} looksVersion={lookVer} />
        {/* Animations on/off for everything a Look moves (and per panel). */}
        <GlobalStyles styles={MOTION_CSS + LIGHT_CSS} />
        <GlobalStyles
          styles={{
            html: {
              minHeight: "100%",
            },
            /*
             * The base colour goes on body only: with no html background, the browser paints the
             * body's colour under the whole page, beneath the background layer and the effects.
             * (A background on html as well would make the body colour cover those layers.)
             */
            body: {
              minHeight: "100%",
              ...(pageBaseColour ? { backgroundColor: pageBaseColour } : {}),
            },
            /*
             * Page-wide layers (background, effects): fixed and as tall as the screen can get
             * (100lvh, with 100vh for older browsers), so a phone's toolbar sliding away never
             * uncovers an unpainted strip.
             */
            ".nx-page-layer": {
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: ["100vh", "100lvh"],
              pointerEvents: "none",
            },
            "#root": {
              minHeight: "100%",
            },
          }}
        />
        {pageGradient ? (
          <div
            aria-hidden="true"
            className="nx-page-layer"
            style={{
              zIndex: -2,
              backgroundImage: pageGradient,
              backgroundSize: gradientCss(shownPrefs.gradientId) ? "100% 100%" : (lookBackground?.size ?? "100% 100%"),
            }}
          />
        ) : null}
        <BackgroundEffects prefs={display.light ? { ...themePrefs, effectId: "off" } : themePrefs} />
        {children}
      </ThemeProvider>
    </SkinContext.Provider>
  );
}

/** The skin context when there is one (null in isolated previews and tests). */
export function useOptionalSkin(): SkinContextValue | null {
  return useContext(SkinContext);
}

export function useSkin(): SkinContextValue {
  const ctx = useContext(SkinContext);
  if (!ctx) {
    throw new Error("useSkin must be used within SkinProvider");
  }
  return ctx;
}

export { DEFAULT_THEME_PREFS };
