import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type PluginInfo } from "../api";
import { useShellAuth } from "../skins/useShellAuth";
import { loadPluginContributions, resetPluginContributions } from "./loadContributions";

type PluginHostContextValue = {
  plugins: PluginInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isPluginEnabled: (pluginId: string) => boolean;
  isPluginPanelTypeEnabled: (panelType: string) => boolean;
  setPluginEnabled: (pluginId: string, enabled: boolean) => Promise<void>;
};

const PluginHostContext = createContext<PluginHostContextValue | null>(null);

export function PluginHostProvider({ children }: { children: ReactNode }) {
  const { signedIn, user } = useShellAuth();
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyContributions = useCallback((list: PluginInfo[]) => {
    resetPluginContributions();
    loadPluginContributions(list);
  }, []);

  const refresh = useCallback(async () => {
    if (!signedIn || !user) {
      setPlugins([]);
      resetPluginContributions();
      return;
    }
    setLoading(true);
    try {
      const res = await api.plugins();
      setPlugins(res.plugins);
      setError(null);
      applyContributions(res.plugins);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plugins");
      setPlugins([]);
      resetPluginContributions();
    } finally {
      setLoading(false);
    }
  }, [signedIn, user, applyContributions]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enabledById = useMemo(() => {
    const map = new Map<string, PluginInfo>();
    for (const p of plugins) {
      map.set(p.id, p);
    }
    return map;
  }, [plugins]);

  const panelTypeToPluginId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of plugins) {
      for (const t of p.panels.map((panel) => panel.type)) {
        map.set(t, p.id);
      }
    }
    return map;
  }, [plugins]);

  const value = useMemo<PluginHostContextValue>(
    () => ({
      plugins,
      loading,
      error,
      refresh,
      isPluginEnabled: (pluginId) => enabledById.get(pluginId)?.enabled === true,
      isPluginPanelTypeEnabled: (panelType) => {
        const pluginId = panelTypeToPluginId.get(panelType);
        if (!pluginId) return false;
        return enabledById.get(pluginId)?.enabled === true;
      },
      setPluginEnabled: async (pluginId, enabled) => {
        const updated = await api.setPluginEnabled(pluginId, enabled);
        setPlugins((prev) => {
          const next = prev.map((p) =>
            p.id === updated.plugin.id ? updated.plugin : p
          );
          applyContributions(next);
          return next;
        });
      },
    }),
    [plugins, loading, error, refresh, enabledById, panelTypeToPluginId, applyContributions]
  );

  return <PluginHostContext.Provider value={value}>{children}</PluginHostContext.Provider>;
}

export function usePluginHost(): PluginHostContextValue {
  const ctx = useContext(PluginHostContext);
  if (!ctx) {
    throw new Error("usePluginHost must be used within PluginHostProvider");
  }
  return ctx;
}

export function usePluginHostOptional(): PluginHostContextValue | null {
  return useContext(PluginHostContext);
}
