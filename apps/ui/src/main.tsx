import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { ConfirmProvider } from "./components/confirm";
import { SkinProvider } from "./skins/SkinProvider";
import { installErrorRing } from "./diagnostics/errorRing";
import { bootstrapV5PanelRegistry } from "./panels/registry";
import { loadCoreContributions } from "./plugins/loadContributions";

installErrorRing();
bootstrapV5PanelRegistry();
loadCoreContributions();

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
