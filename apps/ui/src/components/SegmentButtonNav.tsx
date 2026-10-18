import { Button, Stack } from "@mui/material";
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

/** Horizontal pill-style nav — active = filled, inactive = outlined button. */
export function SegmentButtonNav({ items, activeId }: Props) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <Button
            key={item.id}
            component={RouterLink}
            to={item.to}
            size="small"
            variant={active ? "contained" : "outlined"}
            sx={{ textTransform: "none", fontWeight: active ? 600 : 500 }}
          >
            {item.label}
          </Button>
        );
      })}
    </Stack>
  );
}
