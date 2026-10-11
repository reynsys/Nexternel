import { useRef, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import {
  fileToBrandLogoDataUrl,
  getBrandLogo,
  setBrandLogo,
} from "../../../skins/brandLogo";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";

export function BrandLogoSection() {
  const surfaceSx = useContentSurfaceSx();
  const [brandLogo, setBrandLogoState] = useState<string | null>(() => getBrandLogo());
  const [brandMsg, setBrandMsg] = useState<string | null>(null);
  const brandInputRef = useRef<HTMLInputElement>(null);

  async function onBrandFile(file: File | undefined) {
    if (!file) return;
    setBrandMsg(null);
    try {
      const dataUrl = await fileToBrandLogoDataUrl(file);
      setBrandLogo(dataUrl);
      setBrandLogoState(dataUrl);
      setBrandMsg("Logo updated in the side menu.");
      window.dispatchEvent(new Event("nexternel:brand-logo-updated"));
    } catch (err) {
      setBrandMsg(err instanceof Error ? err.message : "Could not load image");
    }
  }

  function clearBrandLogo() {
    setBrandLogo(null);
    setBrandLogoState(null);
    setBrandMsg("Logo reset to the default blue mark.");
    window.dispatchEvent(new Event("nexternel:brand-logo-updated"));
  }

  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Brand logo
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Logo shown next to Nexternel in the side menu.
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          {brandLogo ? (
            <Box
              component="img"
              src={brandLogo}
              alt="Brand"
              sx={{
                width: 48,
                height: 48,
                borderRadius: "999px",
                objectFit: "cover",
                border: "1px solid",
                borderColor: "divider",
              }}
            />
          ) : (
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "999px",
                backgroundImage:
                  "linear-gradient(135deg, hsl(210, 98%, 60%) 0%, hsl(210, 100%, 35%) 100%)",
                border: "1px solid",
                borderColor: "primary.main",
              }}
            />
          )}
          <input
            ref={brandInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              void onBrandFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button variant="outlined" onClick={() => brandInputRef.current?.click()}>
            Upload logo
          </Button>
          {brandLogo && (
            <Button color="inherit" onClick={clearBrandLogo}>
              Reset default
            </Button>
          )}
        </Stack>
        {brandMsg && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {brandMsg}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
