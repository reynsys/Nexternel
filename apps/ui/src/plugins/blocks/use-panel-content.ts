import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { useLiveChanges } from "../../lib/live-changes";

export type PanelContent = { title: string; body: string; updatedAt: string };

/**
 * What an extension last wrote into one of its panels. Loaded once, then again the moment the
 * extension writes something new (the server announces it on the live "changes" channel), and
 * after a lost connection. No timer asking for news.
 */
export function usePanelContent(pluginId: string, panelId: string): { content: PanelContent | null; loaded: boolean } {
  const [content, setContent] = useState<PanelContent | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    api
      .pluginPanelContent(pluginId, panelId)
      .then((r) => alive && setContent(r.content))
      .catch(() => {
        /* keep what is shown; the next change or reconnect loads again */
      })
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [pluginId, panelId]);

  useEffect(() => load(), [load]);
  useLiveChanges([`plugin-panel:${pluginId}/${panelId}`], () => void load());
  return { content, loaded };
}
