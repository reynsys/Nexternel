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

/** This page's loading of packs while it is under way (a second load waits for it). */
let loading: Promise<void> | null = null;

function run(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
  return (import(/* @vite-ignore */ url) as Promise<{ default?: (h: AddonHost) => void }>)
    .then((mod) => {
      if (typeof mod.default === "function") mod.default(host);
    })
    .finally(() => URL.revokeObjectURL(url));
}

/** Load the active packs not loaded yet (call after sign-in and after installing one). */
export function loadAddons(): Promise<void> {
  // Asked again while loading: after the load under way (so no pack is downloaded or added twice).
  const before = loading?.catch(() => undefined) ?? Promise.resolve();
  const job = before.then(() => loadFromServer());
  loading = job;
  return job;
}

async function loadFromServer(): Promise<void> {
  let list: { id: string; kind: string; version: string; sha: string }[];
  try {
    list = (await api.activeAddons()).addons;
  } catch {
    return;
  }
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
      } catch (err) {
        console.warn(`Add-on ${a.id} could not be loaded`, err);
      }
    }
  });
}
