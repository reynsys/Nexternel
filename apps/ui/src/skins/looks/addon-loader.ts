import * as React from "react";
import { alpha } from "@mui/material/styles";
import { api } from "../../api";
import { addingLooks, registerLook } from "./registry";
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
/** This page's loading of packs while it is under way, so a preview inside it can wait for it. */
const LOADING_KEY = "__nxAddonsLoading";
type PageWithPacks = Window & { [PAGE_KEY]?: Map<string, PackCode>; [LOADING_KEY]?: Promise<void> };

function run(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
  return (import(/* @vite-ignore */ url) as Promise<{ default?: (h: AddonHost) => void }>)
    .then((mod) => {
      if (typeof mod.default === "function") mod.default(host);
    })
    .finally(() => URL.revokeObjectURL(url));
}

/** The page around this one (an Appearance preview) when it loads packs, or null. */
function parentPage(): PageWithPacks | null {
  try {
    if (window.parent === window) return null;
    const parent = window.parent as PageWithPacks;
    return parent[PAGE_KEY] || parent[LOADING_KEY] ? parent : null;
  } catch {
    return null;
  }
}

/** Load the active packs not loaded yet (call after sign-in and after installing one). */
export function loadAddons(): Promise<void> {
  // An Appearance preview takes the packs from the page it sits in: nothing to download again.
  const parent = parentPage();
  if (parent) return loadFromParent(parent);
  const page = window as PageWithPacks;
  // Asked again while loading: after the load under way (so no pack is downloaded or added twice).
  const before = page[LOADING_KEY]?.catch(() => undefined) ?? Promise.resolve();
  const job = before.then(() => loadFromServer(page));
  page[LOADING_KEY] = job;
  return job;
}

/** The packs of the page around this one, once that page has them (it may still be loading them). */
async function loadFromParent(parent: PageWithPacks): Promise<void> {
  await parent[LOADING_KEY]?.catch(() => undefined);
  const packs = parent[PAGE_KEY];
  if (!packs) return;
  await addingLooks(async () => {
    for (const p of packs.values()) {
      if (loaded.get(p.id) === p.sha) continue;
      try {
        await run(p.text);
        loaded.set(p.id, p.sha);
      } catch (err) {
        console.warn(`Add-on ${p.id} could not be loaded`, err);
      }
    }
  });
}

async function loadFromServer(page: PageWithPacks): Promise<void> {
  let list: { id: string; kind: string; version: string; sha: string }[];
  try {
    list = (await api.activeAddons()).addons;
  } catch {
    return;
  }
  const kept = (page[PAGE_KEY] ??= new Map());
  // All packs are downloaded at once, then run one by one in the list's order.
  const wanted = list.filter((a) => loaded.get(a.id) !== a.sha);
  const texts = await Promise.all(
    wanted.map((a) =>
      api
        .addonCode(a.id)
        .then((r) => r.text())
        .catch((err: unknown) => {
          console.warn(`Add-on ${a.id} could not be loaded`, err);
          return null;
        })
    )
  );
  await addingLooks(async () => {
    for (const [i, a] of wanted.entries()) {
      const text = texts[i];
      if (text === null) continue;
      try {
        await run(text);
        loaded.set(a.id, a.sha);
        kept.set(a.id, { id: a.id, sha: a.sha, text });
      } catch (err) {
        console.warn(`Add-on ${a.id} could not be loaded`, err);
      }
    }
  });
}
