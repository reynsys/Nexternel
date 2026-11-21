import { createContext, useContext, type ReactNode } from "react";
import { api, type HistoryBatchResponse, type HistoryRange, type HistoryResponse, type WeatherResponse } from "../api";

/**
 * Where panels get history and weather. On a dashboard that is the server; inside an Appearance
 * preview (LookSample) it is sample readings, so the preview looks the same in every home and asks
 * the server nothing. Only the panels inside a SampleDataProvider get samples.
 */
export type PanelData = {
  history(capabilityId: string, range: HistoryRange): Promise<HistoryResponse>;
  historyBatch(capabilityIds: string[], range: HistoryRange): Promise<HistoryBatchResponse>;
  weather(lat: number, lon: number): Promise<WeatherResponse>;
};

const FROM_SERVER: PanelData = {
  history: (id, range) => api.history(id, range),
  historyBatch: (ids, range) => api.historyBatch(ids, range),
  weather: (lat, lon) => api.weather(lat, lon),
};

const PanelDataContext = createContext<PanelData>(FROM_SERVER);

export function SampleDataProvider({ data, children }: { data: PanelData; children: ReactNode }) {
  return <PanelDataContext.Provider value={data}>{children}</PanelDataContext.Provider>;
}

/** History and weather for the panels here: the server's, or a preview's samples. */
export function usePanelData(): PanelData {
  return useContext(PanelDataContext);
}
