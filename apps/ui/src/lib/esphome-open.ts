import { api } from "../api";

/**
 * Open the ESPHome page in a new tab. It only opens from Nexternel: first Nexternel gives this
 * browser a pass (12 hours), then the tab goes to the page. The tab is opened straight away so the
 * browser does not block it as a pop-up.
 */
export async function openEsphome(url: string): Promise<void> {
  const tab = window.open("about:blank", "_blank");
  try {
    await api.esphomeAccess();
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else window.location.href = url;
  } catch (err) {
    tab?.close();
    window.alert(err instanceof Error ? err.message : "ESPHome could not be opened.");
  }
}
