import { Card, CardContent } from "@mui/material";
import { ActivityList } from "../../../components/ActivityList";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";

/** Settings → Activity: everything that happened in Nexternel, newest first (kept 30 days). */
export function ActivityPage() {
  const surfaceSx = useContentSurfaceSx();
  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <ActivityList />
      </CardContent>
    </Card>
  );
}
