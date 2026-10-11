import type { ResolvedPanelCapability } from "../../api";

/** Capability-agnostic presentation class (LAW 031). */
export type SemanticPresentationClass =
  | "reading"
  | "control"
  | "enum"
  | "text"
  | "binary"
  | "unsupported";

export type SemanticCapabilityView = {
  id: string;
  label: string;
  presentationClass: SemanticPresentationClass;
  value: string;
  unit: string;
  quality: string;
  controllable: boolean;
  priority: number;
  source: ResolvedPanelCapability;
};

export type SemanticPanelMode = "readings" | "controls" | "mixed";

export type SemanticComposition = {
  mode: SemanticPanelMode;
  items: SemanticCapabilityView[];
  emptyMessage: string;
};
