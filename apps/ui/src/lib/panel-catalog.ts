import { api } from "../api";

export type PanelCatalogEntry = {
  kind: string;
  label: string;
  description: string;
  userSelectable: boolean;
  previewOnly: boolean;
  sortOrder: number;
  defaultSize: { w: number; h: number; minW: number; minH: number };
};

let cachedSelectable: PanelCatalogEntry[] | null = null;
let cachedPreview: PanelCatalogEntry[] | null = null;
let selectablePromise: Promise<PanelCatalogEntry[]> | null = null;
let previewPromise: Promise<PanelCatalogEntry[]> | null = null;

function mapPanelRow(p: {
  kind: string;
  label: string;
  description: string;
  userSelectable: boolean;
  previewOnly?: boolean;
  sortOrder: number;
  defaultSize: { w: number; h: number; minW: number; minH: number };
}): PanelCatalogEntry {
  return {
    kind: p.kind,
    label: p.label,
    description: p.description,
    userSelectable: p.userSelectable,
    previewOnly: p.previewOnly ?? false,
    sortOrder: p.sortOrder,
    defaultSize: p.defaultSize,
  };
}

export async function loadSelectablePanels(): Promise<PanelCatalogEntry[]> {
  if (cachedSelectable) return cachedSelectable;
  if (!selectablePromise) {
    selectablePromise = api
      .panelsRegistry()
      .then((r) => {
        cachedSelectable = r.panels.map(mapPanelRow);
        return cachedSelectable;
      })
      .finally(() => {
        selectablePromise = null;
      });
  }
  return selectablePromise;
}

export async function loadPreviewPanels(): Promise<PanelCatalogEntry[]> {
  if (cachedPreview) return cachedPreview;
  if (!previewPromise) {
    previewPromise = api
      .panelsRegistry({ preview: true })
      .then((r) => {
        cachedPreview = r.panels.map(mapPanelRow);
        return cachedPreview;
      })
      .finally(() => {
        previewPromise = null;
      });
  }
  return previewPromise;
}

export function panelLabelFromCatalog(
  kind: string,
  catalog: PanelCatalogEntry[]
): string {
  return catalog.find((p) => p.kind === kind)?.label ?? "Panel";
}

export function panelSizeFromCatalog(
  kind: string,
  catalog: PanelCatalogEntry[]
): PanelCatalogEntry["defaultSize"] {
  return (
    catalog.find((p) => p.kind === kind)?.defaultSize ?? {
      w: 4,
      h: 3,
      minW: 3,
      minH: 2,
    }
  );
}

export async function loadSystemsInScope(areaIds: string[]): Promise<
  { id: string; label: string }[]
> {
  const r = await api.v4Systems({ areaIds });
  return r.systems.map((s) => ({ id: s.id, label: s.label }));
}
