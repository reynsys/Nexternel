import { HomeNameCard } from "./HomeNameCard";
import { useShellAuth } from "../../../skins/useShellAuth";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";

/** Settings → Home: about the home itself (its name, set first in the setup wizard). */
export function HomeSettingsPage() {
  const surfaceSx = useContentSurfaceSx();
  const { isAdmin } = useShellAuth();
  return <HomeNameCard surfaceSx={surfaceSx} canEdit={Boolean(isAdmin)} />;
}
