import { useEffect, useState } from "react";
import { api, type BoardPrepareRun, type BoardStatus, type BoardUpdateRun } from "../api";

/**
 * Board updates, shared by the Devices page and each device's page: which ESPHome boards need an
 * update and the update in progress. One copy for the whole app; it checks every 3 seconds while an
 * update runs, otherwise when asked (refresh) or every minute.
 */
type State = { boards: BoardStatus[] | null; run: BoardUpdateRun | null; preparing: BoardPrepareRun | null; error: string | null };
let state: State = { boards: null, run: null, preparing: null, error: null };
const listeners = new Set<(s: State) => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  for (const l of listeners) l(state);
}

export async function refreshBoards(): Promise<void> {
  try {
    const r = await api.esphomeBoards();
    emit({ boards: r.boards, run: r.run, preparing: r.preparing ?? null, error: null });
  } catch (err) {
    emit({ error: err instanceof Error ? err.message : "Could not check the boards" });
  }
  schedule();
}

function schedule() {
  if (timer) clearTimeout(timer);
  if (!listeners.size) return;
  timer = setTimeout(() => void refreshBoards(), state.run?.running || state.preparing?.running ? 3_000 : 60_000);
}

export async function updateBoards(deviceIds: string[]): Promise<void> {
  const r = await api.startBoardUpdates(deviceIds);
  emit({ run: r.run });
  schedule();
}

export function useBoardUpdates(): State {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    if (listeners.size === 1) void refreshBoards();
    else setS(state);
    return () => {
      listeners.delete(setS);
      if (!listeners.size && timer) clearTimeout(timer);
    };
  }, []);
  return s;
}
