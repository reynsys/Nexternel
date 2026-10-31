import { useEffect, useRef } from "react";
import { APP_VERSION } from "../version";
import { CLIENT_ID, connectLiveSocket, getStoredAccessToken, type LiveEvent } from "../api";

/**
 * Every open screen hears when something changes in Nexternel (a dashboard, your appearance,
 * an add-on, a device…) and shows it straight away — no refresh, no signing in again. One socket
 * per screen; parts of the page subscribe to the areas they show (useLiveChanges).
 * After a lost connection everything is reloaded (changes may have been missed), and after a
 * Nexternel update the page reloads itself so wall screens run the new version.
 */
export type ChangeTopic =
  | "dashboards"
  | "me"
  | "users"
  | "roles"
  | "devices"
  | "capabilities"
  | "cameras"
  | "rooms"
  | "addons"
  | "plugins"
  | "notifications"
  | "system";

type Listener = { topics: Set<string>; fn: (topic: string) => void };
const listeners = new Set<Listener>();
let stop: (() => void) | null = null;
let connectedBefore = false;
const pending = new Map<Listener, Set<string>>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function queue(topic: string) {
  for (const l of listeners) {
    if (topic !== "*" && !l.topics.has(topic)) continue;
    const set = pending.get(l) ?? new Set<string>();
    set.add(topic);
    pending.set(l, set);
  }
  // Several changes close together (saving a dashboard) cause one reload.
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const batch = [...pending];
    pending.clear();
    for (const [l, topics] of batch) for (const t of topics) l.fn(t);
  }, 300);
}

function onEvent(ev: LiveEvent & { topic?: string; client?: string | null; channel?: string; version?: string }) {
  if (ev.type === "hello" && ev.channel === "changes") {
    if (ev.version && ev.version !== APP_VERSION) {
      // Nexternel was updated: load the new version (once per version, so a mismatch can never loop).
      let tried: string | null = null;
      try {
        tried = sessionStorage.getItem("nx-reloaded-for");
        sessionStorage.setItem("nx-reloaded-for", ev.version);
      } catch {
        /* storage unavailable: still reload once below */
      }
      if (tried !== ev.version) {
        window.location.reload();
        return;
      }
    }
    if (connectedBefore) queue("*");
    connectedBefore = true;
    return;
  }
  if (ev.type !== "changed" || !ev.topic) return;
  if (ev.client && ev.client === CLIENT_ID) return; // this screen made the change
  queue(ev.topic);
}

let waitTimer: ReturnType<typeof setInterval> | null = null;
function ensureConnected() {
  if (stop) return;
  if (!getStoredAccessToken()) {
    // Not signed in yet: connect as soon as there is a session.
    waitTimer ??= setInterval(() => {
      if (!getStoredAccessToken() || !listeners.size) return;
      clearInterval(waitTimer!);
      waitTimer = null;
      ensureConnected();
    }, 3000);
    return;
  }
  stop = connectLiveSocket(onEvent as (ev: LiveEvent) => void, "changes");
}

export function onLiveChanges(topics: ChangeTopic[], fn: (topic: string) => void): () => void {
  const l: Listener = { topics: new Set(topics), fn };
  listeners.add(l);
  ensureConnected();
  return () => {
    listeners.delete(l);
    pending.delete(l);
    if (!listeners.size && stop) {
      stop();
      stop = null;
      connectedBefore = false;
    }
  };
}

/**
 * Tell the other parts of THIS screen that something changed here (other screens hear it from the
 * server; the server's notice is skipped on the screen that made the change). E.g. arranging the
 * dashboards in the tabs also reorders a Rooms panel on the same page.
 */
export function announceLocalChange(topic: ChangeTopic): void {
  queue(topic);
}

/** Run `reload` when another screen changes one of these areas (or after a lost connection). */
export function useLiveChanges(topics: ChangeTopic[], reload: (topic: string) => void, enabled = true): void {
  const ref = useRef(reload);
  ref.current = reload;
  const key = topics.join(",");
  useEffect(() => {
    if (!enabled) return undefined;
    return onLiveChanges(key.split(",") as ChangeTopic[], (t) => ref.current(t));
  }, [key, enabled]);
}
