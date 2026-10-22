import type { Scheme } from "../lib/appearance/scheme";
import type { Theme } from "@mui/material/styles";
import type { ComponentType } from "react";
import type { ThemePrefs } from "./themePrefs";

/** UI chrome pack — theme + shell layout (not dashboard widget documents). */
export type UiSkin = {
  id: string;
  label: string;
  description?: string;
  createTheme: (prefs: ThemePrefs, scheme?: Scheme) => Theme;
  Layout: ComponentType;
};
