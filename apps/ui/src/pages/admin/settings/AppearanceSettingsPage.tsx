import { Stack } from "@mui/material";
import { ThemeOptionsPanel } from "../../../skins/ThemeOptionsPanel";
import { BrandLogoSection } from "../sections/BrandLogoSection";
import { useShellAuth } from "../../../skins/useShellAuth";

export function AppearanceSettingsPage() {
  const { isAdmin, permissions } = useShellAuth();
  const canEditBrand = Boolean(isAdmin || permissions?.manageUsers);

  return (
    <Stack spacing={2}>
      <ThemeOptionsPanel />
      {canEditBrand && <BrandLogoSection />}
    </Stack>
  );
}
