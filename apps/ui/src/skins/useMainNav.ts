import { useMemo } from "react";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { usePluginHostOptional } from "../plugins/PluginHostContext";
import { MAIN_NAV, type NavItem } from "./nav";

/** The main menu with the pages of switched-on plugins, just above Settings. */
export function useMainNav(): NavItem[] {
  const plugins = usePluginHostOptional()?.plugins;
  return useMemo(() => {
    const pages: NavItem[] = (plugins ?? [])
      .filter((p) => p.enabled)
      .flatMap((p) =>
        (p.pages ?? []).map((page) => ({
          label: page.label,
          to: `/plugin-page/${p.id}/${page.id}`,
          icon: page.block === "setup" ? TuneOutlinedIcon : PlaceOutlinedIcon,
          auth: true,
        }))
      );
    const settings = MAIN_NAV.findIndex((item) => item.to === "/admin/settings");
    return [...MAIN_NAV.slice(0, settings), ...pages, ...MAIN_NAV.slice(settings)];
  }, [plugins]);
}
