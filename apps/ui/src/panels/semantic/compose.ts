import type { ResolvedPanelCapability } from "../../api";
import { controlsActionCapabilities } from "../panel-capabilities";
import { parseCapabilityReading } from "../parse-capability-reading";
import {
  classifyCapabilityPresentation,
  semanticDisplayPriority,
} from "./classify";
import type { SemanticComposition, SemanticCapabilityView, SemanticPanelMode } from "./types";

function toSemanticView(cap: ResolvedPanelCapability): SemanticCapabilityView {
  const presentationClass = classifyCapabilityPresentation(cap);
  const { value, unit } = parseCapabilityReading(cap);
  return {
    id: cap.id,
    label: cap.name,
    presentationClass,
    value,
    unit,
    quality: cap.state?.quality ?? "unknown",
    controllable: presentationClass === "control",
    priority: semanticDisplayPriority(presentationClass),
    source: cap,
  };
}

export function composeSemanticPanel(
  capabilities: ResolvedPanelCapability[],
  mode: SemanticPanelMode
): SemanticComposition {
  const controls = controlsActionCapabilities(capabilities).map(toSemanticView);
  const readings = capabilities
    .filter((cap) => !controls.some((c) => c.id === cap.id))
    .map(toSemanticView);

  if (mode === "controls") {
    return {
      mode: "controls",
      items: controls.sort((a, b) => b.priority - a.priority),
      emptyMessage: "No controls in this scope.",
    };
  }

  if (mode === "readings") {
    return {
      mode: "readings",
      items: readings.sort((a, b) => b.priority - a.priority),
      emptyMessage: "No readings in this scope.",
    };
  }

  const items = [...controls, ...readings].sort((a, b) => b.priority - a.priority);
  return {
    mode: "mixed",
    items,
    emptyMessage: "No capabilities in this scope.",
  };
}

/** Limit visible items in summary degradation mode. */
export function itemsForResponsiveState(
  items: SemanticCapabilityView[],
  state: "comfortable" | "compact" | "summary" | "insufficient"
): SemanticCapabilityView[] {
  if (state === "comfortable" || state === "compact") return items;
  if (state === "summary") return items.slice(0, Math.min(3, items.length));
  return [];
}
