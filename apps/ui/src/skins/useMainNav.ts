import { useMemo } from "react";
import ExtensionRoundedIcon from "@mui/icons-material/ExtensionRounded";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { usePluginHostOptional } from "../plugins/PluginHostContext";
import { MAIN_NAV, type NavItem } from "./nav";

/**
 * The main menu, with one Extensions group just above Settings for the pages of switched-on plugins.
 * It stays one button however many are added. A setup page has no place here: it opens from
 * Settings → Extensions, and the extension is used from its panels.
 */
export function useMainNav(): NavItem[] {
  const plugins = usePluginHostOptional()?.plugins;
  return useMemo(() => {
    const pages: NavItem[] = (plugins ?? [])
      .filter((p) => p.enabled)
      .flatMap((p) =>
        (p.pages ?? [])
          .filter((page) => page.block !== "setup")
          .map((page) => ({
            label: page.label,
            to: `/plugin-page/${p.id}/${page.id}`,
            icon: PlaceOutlinedIcon,
            auth: true,
          }))
      );
    if (pages.length === 0) return MAIN_NAV;
    const group: NavItem = {
      label: "Extensions",
      to: pages[0]!.to,
      icon: ExtensionRoundedIcon,
      auth: true,
      alsoActiveFor: pages.map((p) => p.to),
      children: pages,
    };
    const settings = MAIN_NAV.findIndex((item) => item.to === "/admin/settings");
    return [...MAIN_NAV.slice(0, settings), group, ...MAIN_NAV.slice(settings)];
  }, [plugins]);
}
