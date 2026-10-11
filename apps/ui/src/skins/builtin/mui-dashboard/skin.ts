import type { UiSkin } from "../../types";
import { MuiDashboardLayout } from "./Layout";
import { createMuiDashboardTheme } from "./theme";

export const muiDashboardSkin: UiSkin = {
  id: "mui-dashboard",
  label: "Side menu",
  description: "Navigation menu on the left",
  createTheme: createMuiDashboardTheme,
  Layout: MuiDashboardLayout,
};

export default muiDashboardSkin;
