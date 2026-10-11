import type { ResolvedPanelCapability } from "../../api";
import { isControllableResolvedCapability } from "../panel-capabilities";
import type { SemanticPresentationClass } from "./types";

const ENUM_KINDS = new Set(["enum", "alarm", "lock", "door", "motion", "binary_sensor"]);

/**
 * Classify a capability by semantic presentation — never by sensor/device identity (LAW 031).
 */
export function classifyCapabilityPresentation(
  cap: ResolvedPanelCapability
): SemanticPresentationClass {
  if (isControllableResolvedCapability(cap)) return "control";
  if (ENUM_KINDS.has(cap.kind)) return "enum";
  if (cap.kind === "text") return "text";
  if (cap.kind === "switch") return "binary";

  const value = cap.state?.value;
  if (typeof value === "boolean") return "binary";
  if (typeof value === "number") return "reading";
  if (cap.unit?.trim()) return "reading";

  return "text";
}

/** Generic priority for degradation — higher shown first in summary mode. */
export function semanticDisplayPriority(
  presentationClass: SemanticPresentationClass
): number {
  switch (presentationClass) {
    case "control":
      return 100;
    case "binary":
      return 90;
    case "enum":
      return 80;
    case "reading":
      return 70;
    case "text":
      return 60;
    default:
      return 0;
  }
}
