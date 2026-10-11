import type { UiSkin } from "../../types";
import { ClassicLayout } from "./Layout";
import { createClassicTheme } from "./theme";

export const classicSkin: UiSkin = {
  id: "classic",
  label: "Top menu",
  description: "Navigation links across the top",
  createTheme: createClassicTheme,
  Layout: ClassicLayout,
};

export default classicSkin;
