import type { UiSkin } from "./types";
import { classicSkin } from "./builtin/classic/skin";
import { muiDashboardSkin } from "./builtin/mui-dashboard/skin";
import { DEFAULT_SKIN_ID } from "./activeSkin";

const builtins: UiSkin[] = [muiDashboardSkin, classicSkin];

type SkinModule = { default?: UiSkin; skin?: UiSkin };

function loadLocalSkins(): UiSkin[] {
  const mods = import.meta.glob<SkinModule>("./local/*/skin.ts", { eager: true });
  const out: UiSkin[] = [];
  for (const mod of Object.values(mods)) {
    const skin = mod.default ?? mod.skin;
    if (skin?.id && skin.Layout && typeof skin.createTheme === "function") {
      out.push(skin);
    }
  }
  return out;
}

const byId = new Map<string, UiSkin>();

function rebuild() {
  byId.clear();
  for (const s of [...builtins, ...loadLocalSkins()]) {
    byId.set(s.id, s);
  }
}

rebuild();

export function listSkins(): UiSkin[] {
  return Array.from(byId.values());
}

export function getSkin(id: string | null | undefined): UiSkin {
  if (id && byId.has(id)) return byId.get(id)!;
  return byId.get(DEFAULT_SKIN_ID) ?? builtins[0]!;
}
