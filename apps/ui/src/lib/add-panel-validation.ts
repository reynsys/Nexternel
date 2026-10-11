import { isCorePanelCatalogType } from "@nexternel/domain";
import type { PanelContentMode } from "@nexternel/domain";
import type { CameraRecord, ResolvedPanelCapability } from "../api";
import { getPanelContribution } from "../plugins/registry";

export type AddPanelValidationInput = {
  panelType: string;
  contentMode: PanelContentMode;
  capabilityIds: string[];
  cameraIds: string[];
  scopeCapabilities: ResolvedPanelCapability[];
  cameras: CameraRecord[];
  slotValues: Record<string, string>;
};

export type AddPanelValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateAddPanelReady(input: AddPanelValidationInput): AddPanelValidationResult {
  if (!isCorePanelCatalogType(input.panelType)) {
    const contribution = getPanelContribution(input.panelType);
    if (!contribution) {
      return { ok: false, message: "This panel type is not available." };
    }
    const missing = (contribution.bindingSlots ?? []).filter(
      (slot) => slot.required && !input.slotValues[slot.key]?.trim()
    );
    if (missing.length > 0) {
      return { ok: false, message: `Choose: ${missing.map((s) => s.label).join(", ")}` };
    }
    return { ok: true };
  }

  const kind = input.panelType;

  if (kind === "panel.camera") {
    if (input.cameras.length === 0) {
      return { ok: false, message: "No cameras are available to add yet." };
    }
    if (input.contentMode === "manual" && input.cameraIds.length === 0) {
      return { ok: false, message: "Choose at least one camera for this panel." };
    }
    return { ok: true };
  }

  if (kind === "panel.charts" || kind === "panel.controls" || kind === "panel.status") {
    if (input.scopeCapabilities.length === 0) {
      if (kind === "panel.charts") {
        return {
          ok: false,
          message: "No chartable history is currently available for this scope.",
        };
      }
      if (kind === "panel.controls") {
        return { ok: false, message: "No controllable items match this scope yet." };
      }
      return { ok: false, message: "No readable values match this scope yet." };
    }
    if (input.contentMode === "manual" && input.capabilityIds.length === 0) {
      if (kind === "panel.charts") {
        return { ok: false, message: "Choose at least one value to chart." };
      }
      if (kind === "panel.controls") {
        return { ok: false, message: "Choose at least one item to control." };
      }
      return { ok: false, message: "Choose at least one value to show." };
    }
    return { ok: true };
  }

  return { ok: true };
}
