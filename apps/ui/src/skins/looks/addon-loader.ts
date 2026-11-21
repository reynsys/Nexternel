import * as React from "react";
import { alpha } from "@mui/material/styles";
import { api } from "../../api";
import { registerLook } from "./registry";
import type { UiLook } from "./types";

/**
 * Paid add-ons run in the browser: their code comes from this server's API only while their
 * licence is valid (never from a public file). Each pack is an ES module whose default export
 * receives this host and registers what it brings.
 */
export type AddonHost = {
  apiVersion: 1;
  React: typeof React;
  alpha: typeof alpha;
  registerLook: (look: UiLook) => boolean;
};

const host: AddonHost = { apiVersion: 1, React, alpha, registerLook };
const loaded = new Map<string, string>();

type PackCode = { id: string; sha: string; text: string };
/** Packs this page has loaded, kept so the Appearance previews inside it (same address) reuse them. */
const PAGE_KEY = "__nxAddonCode";
type PageWithPacks = Window & { [PAGE_KEY]?: Map<string, PackCode> };

function run(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
  return (import(/* @vite-ignore */ url) as Promise<{ default?: (h: AddonHost) => void }>)
    .then((mod) => {
      if (typeof mod.default === "function") mod.default(host);
    })
    .finally(() => URL.revokeObjectURL(url));
}

/** The packs the page around this one has loaded (an Appearance preview), or null. */
function parentPacks(): Map<string, PackCode> | null {
  try {
    if (window.parent === window) return null;
    return (window.parent as PageWithPacks)[PAGE_KEY] ?? null;
  } catch {
    return null;
  }
}

/** Load the active packs not loaded yet (call after sign-in and after installing one). */
export async function loadAddons(): Promise<void> {
  // An Appearance preview takes the packs from the page it sits in: nothing to download again.
  const fromParent = parentPacks();
  if (fromParent) {
    for (const p of fromParent.values()) {
      if (loaded.get(p.id) === p.sha) continue;
      try {
        await run(p.text);
        loaded.set(p.id, p.sha);
      } catch (err) {
        console.warn(`Add-on ${p.id} could not be loaded`, err);
      }
    }
    return;
  }
  let list: { id: string; kind: string; version: string; sha: string }[];
  try {
    list = (await api.activeAddons()).addons;
  } catch {
    return;
  }
  const page = window as PageWithPacks;
  const kept = (page[PAGE_KEY] ??= new Map());
  for (const a of list) {
    if (loaded.get(a.id) === a.sha) continue;
    try {
      const text = await (await api.addonCode(a.id)).text();
      await run(text);
      loaded.set(a.id, a.sha);
      kept.set(a.id, { id: a.id, sha: a.sha, text });
    } catch (err) {
      console.warn(`Add-on ${a.id} could not be loaded`, err);
    }
  }
}
