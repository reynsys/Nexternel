import { useEffect } from "react";
import { useSkin } from "../skins/SkinProvider";
import { api, getStoredAccessToken } from "../api";
import { showHomeInTab } from "../lib/home-title";

/** Delegates chrome to the active UI skin Layout. Theme options: Settings → Appearance. */
export function AppLayout() {
  const { skin } = useSkin();
  const Layout = skin.Layout;
  // The home's name in the browser tab (Settings → System → Your home).
  useEffect(() => {
    if (!getStoredAccessToken()) return;
    void api
      .home()
      .then(({ home }) => showHomeInTab(home.name))
      .catch(() => {
        /* the tab keeps "Nexternel" */
      });
  }, []);
  return <Layout />;
}
