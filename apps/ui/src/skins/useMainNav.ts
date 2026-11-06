import { useMemo } from "react";
import ExtensionRoundedIcon from "@mui/icons-material/ExtensionRounded";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import { usePluginHostOptional } from "../plugins/PluginHostContext";
import { MAIN_NAV, MANAGE_EXTENSIONS_PATH, type NavItem } from "./nav";

/**
 * The main menu, with one Extensions group just above Settings: the page of each switched-on
 * extension, then Manage extensions. It stays one button however many are added.
 */
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
    const manage: NavItem = {
      label: "Manage extensions",
      to: MANAGE_EXTENSIONS_PATH,
      icon: ExtensionRoundedIcon,
      auth: true,
      permission: "viewSystem",
    };
    const children = [...pages, manage];
    const group: NavItem = {
      label: "Extensions",
      to: children[0]!.to,
      icon: ExtensionRoundedIcon,
      auth: true,
      alsoActiveFor: children.map((c) => c.to),
      children,
    };
    const settings = MAIN_NAV.findIndex((item) => item.to === "/admin/settings");
    return [...MAIN_NAV.slice(0, settings), group, ...MAIN_NAV.slice(settings)];
  }, [plugins]);
}
