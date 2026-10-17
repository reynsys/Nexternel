import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ThemeProvider, CssBaseline, GlobalStyles } from "@mui/material";
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
import { BackgroundEffects } from "./effects/BackgroundEffects";

type SkinContextValue = {
  skin: UiSkin;
  skins: UiSkin[];
  setSkinId: (id: string) => void;
  themePrefs: ThemePrefs;
  setThemePrefs: (prefs: ThemePrefs | ((prev: ThemePrefs) => ThemePrefs)) => void;
  /** Apply prefs from the signed-in user account (login / me). */
  applyAccountPrefs: (prefs: UserThemePrefs | null | undefined) => void;
};

const SkinContext = createContext<SkinContextValue | null>(null);

export function SkinProvider({ children }: { children: ReactNode }) {
  const [skinId, setSkinIdState] = useState(() => getActiveSkinId());
  const [themePrefs, setThemePrefsState] = useState<ThemePrefs>(() => getThemePrefs());
  const skins = useMemo(() => listSkins(), []);
  const skin = useMemo(() => getSkin(skinId), [skinId]);
  const theme = useMemo(
    () => skin.createTheme(themePrefs),
    [skin, themePrefs]
  );
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

  const pageGradient = useMemo(
    () => gradientCss(themePrefs.gradientId, themePrefs.mode),
    [themePrefs.gradientId, themePrefs.mode]
  );
  const pageBaseColour = useMemo(
    () => gradientBaseColour(themePrefs.gradientId, themePrefs.mode),
    [themePrefs.gradientId, themePrefs.mode]
  );

  const value = useMemo(
    () => ({
      skin,
      skins,
      setSkinId,
      themePrefs,
      setThemePrefs,
      applyAccountPrefs,
    }),
    [skin, skins, setSkinId, themePrefs, setThemePrefs, applyAccountPrefs]
  );

  return (
    <SkinContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppearanceCssVars lookId={themePrefs.lookId} />
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
            style={{ zIndex: -2, backgroundImage: pageGradient, backgroundSize: "100% 100%" }}
          />
        ) : null}
        <BackgroundEffects prefs={themePrefs} />
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
