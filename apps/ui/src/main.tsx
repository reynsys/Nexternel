import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./lib/appearance/fonts-load";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { ConfirmProvider } from "./components/confirm";
import { SkinProvider } from "./skins/SkinProvider";
import { installErrorRing } from "./diagnostics/errorRing";
import { bootstrapV5PanelRegistry } from "./panels/registry";
import { loadCoreContributions } from "./plugins/loadContributions";

// Inside Nexternel for Android the page does not pinch-zoom (like other phone apps), so the dock stays
// on screen; bigger text comes from Settings → Appearance → Text size and the phone's own text size.
if ((window as unknown as { NexternelPhone?: unknown }).NexternelPhone) {
  document.querySelector('meta[name="viewport"]')?.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no");
}

installErrorRing();
bootstrapV5PanelRegistry();
loadCoreContributions();

// Shortcut helper (public/sw.js): lets Nexternel be installed as a full-screen shortcut.
// Browsers allow it only on a padlock address (Nexternel Anywhere), so skip it elsewhere.
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <SkinProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ConfirmProvider>
      </SkinProvider>
    </AppErrorBoundary>
  </StrictMode>
);
