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

/** Load the active packs not loaded yet (call after sign-in and after installing one). */
export async function loadAddons(): Promise<void> {
  let list: { id: string; kind: string; version: string; sha: string }[];
  try {
    list = (await api.activeAddons()).addons;
  } catch {
    return;
  }
  for (const a of list) {
    if (loaded.get(a.id) === a.sha) continue;
    try {
      const blob = await api.addonCode(a.id);
      const url = URL.createObjectURL(new Blob([await blob.text()], { type: "text/javascript" }));
      try {
        const mod = (await import(/* @vite-ignore */ url)) as { default?: (h: AddonHost) => void };
        if (typeof mod.default === "function") mod.default(host);
        loaded.set(a.id, a.sha);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.warn(`Add-on ${a.id} could not be loaded`, err);
    }
  }
}
