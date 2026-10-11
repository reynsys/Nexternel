import { useMemo, useState } from "react";
import { Box, List, ListItemButton, ListItemText, TextField, Typography } from "@mui/material";
import {
  filterAddPanelDiscovery,
  groupAddPanelDiscovery,
  type AddPanelDiscoveryItem,
} from "../lib/add-panel-discovery";

type Props = {
  catalog: AddPanelDiscoveryItem[];
  value: string;
  onChange: (typeId: string) => void;
};

function showGroupHeading(section: string, items: AddPanelDiscoveryItem[]): boolean {
  if (section === "system") return true;
  return items.length > 1;
}

export function AddPanelTypePicker({ catalog, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterAddPanelDiscovery(catalog, query), [catalog, query]);
  const groups = useMemo(() => groupAddPanelDiscovery(filtered), [filtered]);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Panel type
      </Typography>
      <TextField
        size="small"
        fullWidth
        label="Search"
        placeholder="Clock, Weather, Gauge…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ mb: 1.5 }}
      />
      <List
        dense
        aria-label="Panel type"
        sx={{
          maxHeight: 320,
          overflow: "auto",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        {groups.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No panels match your search.
          </Typography>
        )}
        {groups.map((group) => (
          <Box key={group.section}>
            {showGroupHeading(group.section, group.items) && (
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: "block", px: 2, pt: 1, pb: 0.5, lineHeight: 1.4 }}
              >
                {group.label}
              </Typography>
            )}
            {group.items.map((item) => (
              <ListItemButton
                key={item.id}
                selected={value === item.id}
                onClick={() => onChange(item.id)}
              >
                <ListItemText
                  primary={item.label}
                  secondary={item.description}
                  primaryTypographyProps={{ variant: "body2", fontWeight: 600 }}
                  secondaryTypographyProps={{ variant: "caption" }}
                />
              </ListItemButton>
            ))}
          </Box>
        ))}
      </List>
    </Box>
  );
}
