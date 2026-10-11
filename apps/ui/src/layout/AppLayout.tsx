import { useSkin } from "../skins/SkinProvider";

/** Delegates chrome to the active UI skin Layout. Theme options: Settings → Appearance. */
export function AppLayout() {
  const { skin } = useSkin();
  const Layout = skin.Layout;
  return <Layout />;
}
