import { Link as RouterLink, useLocation } from "react-router-dom";
import { Tab, Tabs } from "@mui/material";
import DevicesRoundedIcon from "@mui/icons-material/DevicesRounded";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";

/** Devices and Cameras are one menu entry; these tabs switch between the two pages. */
export function DevicesTabs() {
  const { pathname } = useLocation();
  const value = pathname.startsWith("/admin/cameras") ? "/admin/cameras" : "/admin/devices";
  return (
    <Tabs value={value} sx={{ mb: 1 }}>
      <Tab
        value="/admin/devices"
        label="Devices"
        icon={<DevicesRoundedIcon fontSize="small" />}
        iconPosition="start"
        component={RouterLink}
        to="/admin/devices"
      />
      <Tab
        value="/admin/cameras"
        label="Cameras"
        icon={<VideocamRoundedIcon fontSize="small" />}
        iconPosition="start"
        component={RouterLink}
        to="/admin/cameras"
      />
    </Tabs>
  );
}
