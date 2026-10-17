import { isLookId, STANDARD_LOOK_ID } from "../../lib/look-choice";
import { BUILTIN_LOOKS, standardLook } from "./builtin";
import type { UiLook } from "./types";

type LookModule = { default?: UiLook; look?: UiLook };

/**
 * Look packs that are not part of the public release live in skins/local/looks/<id>/look.ts
 * (skins/local is never exported to GitHub, see skins/local/README.md).
 */
function loadLocalLooks(): UiLook[] {
  const mods = import.meta.glob<LookModule>("../local/looks/*/look.ts", { eager: true });
  const out: UiLook[] = [];
  for (const mod of Object.values(mods)) {
    const look = mod.default ?? mod.look;
    if (look && isLookId(look.id) && typeof look.tokens === "function") out.push(look);
  }
  return out;
}

const byId = new Map<string, UiLook>();
for (const look of [...BUILTIN_LOOKS, ...loadLocalLooks()]) {
  if (!byId.has(look.id)) byId.set(look.id, look);
}

/** Every Look installed on this server, Standard first. */
export function listLooks(): UiLook[] {
  return Array.from(byId.values());
}

/** The Look to show: the chosen one, or Standard when it is not installed here. */
export function resolveLook(id: string | null | undefined): UiLook {
  return (id && byId.get(id)) || byId.get(STANDARD_LOOK_ID) || standardLook;
}
