import { isLookId, STANDARD_LOOK_ID } from "../../lib/look-choice";
import { BUILTIN_LOOKS, standardLook } from "./builtin";
import type { UiLook } from "./types";

type LookModule = { default?: UiLook; look?: UiLook };

/**
 * Looks: the built-in ones, private packs built into this copy (skins/local/looks/<id>/look.ts,
 * never exported to GitHub) and paid add-ons loaded while Nexternel runs (addon-loader.ts).
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

let version = 0;
const listeners = new Set<() => void>();
let telling = false;
/** While packs are being added (addingLooks), the page is told once, at the end. */
let holding = 0;
let heldNews = false;

function tell() {
  if (holding > 0) {
    heldNews = true;
    return;
  }
  // Looks added together (a pack brings several) re-draw the page once, not once each.
  if (telling) return;
  telling = true;
  queueMicrotask(() => {
    telling = false;
    listeners.forEach((l) => l());
  });
}

/** Add several packs' Looks as one change: the page re-draws once when all are in. */
export async function addingLooks(add: () => Promise<void>): Promise<void> {
  holding += 1;
  try {
    await add();
  } finally {
    holding -= 1;
    if (holding === 0 && heldNews) {
      heldNews = false;
      tell();
    }
  }
}

/** Add a Look (from an add-on). A built-in Look's id cannot be taken. */
export function registerLook(look: UiLook): boolean {
  if (!look || !isLookId(look.id) || typeof look.tokens !== "function") return false;
  if (BUILTIN_LOOKS.some((b) => b.id === look.id)) return false;
  byId.set(look.id, look);
  version += 1;
  tell();
  return true;
}

/** For useSyncExternalStore: re-draw when an add-on adds a Look. */
export function subscribeLooks(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function looksVersion(): number {
  return version;
}

/** Every Look available here, Standard first. */
export function listLooks(): UiLook[] {
  return Array.from(byId.values());
}

/** The Look to show: the chosen one, or Standard when it is not installed here. */
export function resolveLook(id: string | null | undefined): UiLook {
  return (id && byId.get(id)) || byId.get(STANDARD_LOOK_ID) || standardLook;
}
