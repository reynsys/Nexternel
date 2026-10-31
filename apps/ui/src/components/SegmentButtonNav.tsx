import { Tab, Tabs } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export type SegmentNavItem = {
  id: string;
  label: string;
  to: string;
};

type Props = {
  items: SegmentNavItem[];
  activeId: string;
};

/** Pages of one area as tabs (phones: the Settings pages) — they switch what is shown, so they look like tabs, not buttons. */
export function SegmentButtonNav({ items, activeId }: Props) {
  return (
    <Tabs value={items.some((i) => i.id === activeId) ? activeId : false} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2 }}>
      {items.map((item) => (
        <Tab key={item.id} value={item.id} label={item.label} component={RouterLink} to={item.to} />
      ))}
    </Tabs>
  );
}
