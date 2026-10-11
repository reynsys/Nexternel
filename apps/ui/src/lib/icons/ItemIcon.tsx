import { useEffect, useState } from "react";
import type { SxProps, Theme } from "@mui/material/styles";
import { kindIcon } from "../capability-icons";

type CatalogModule = typeof import("./catalog");

let catalog: CatalogModule | null = null;
let loading: Promise<CatalogModule> | null = null;

/** The icon catalogue downloads once, the first time a chosen icon or the picker is shown. */
export function loadIconCatalog(): Promise<CatalogModule> {
  if (catalog) return Promise.resolve(catalog);
  loading ??= import("./catalog").then((m) => (catalog = m));
  return loading;
}

export function useIconCatalog(enabled = true): CatalogModule | null {
  const [mod, setMod] = useState<CatalogModule | null>(catalog);
  useEffect(() => {
    if (!enabled || mod) return;
    let live = true;
    void loadIconCatalog().then((m) => live && setMod(m));
    return () => {
      live = false;
    };
  }, [enabled, mod]);
  return mod;
}

/**
 * A reading's icon: a chosen catalogue icon, or for "auto" (and while the catalogue loads, or for an
 * id it does not know) the icon for its kind of reading.
 */
export function ItemIcon({
  iconId,
  kind,
  sx,
}: {
  iconId: string | null | undefined;
  kind?: string | null;
  sx?: SxProps<Theme>;
}) {
  const chosen = Boolean(iconId && iconId !== "auto");
  const mod = useIconCatalog(chosen);
  const Icon = (chosen && mod?.iconById(iconId)?.Icon) || kindIcon(kind);
  return <Icon aria-hidden sx={sx} />;
}
