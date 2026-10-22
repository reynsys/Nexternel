import { Box, ButtonBase, Switch, Typography } from "@mui/material";
import { SWITCH_STYLES, type SwitchStyleId } from "../../lib/switch-styles";
import { SwitchStyleVisual, SwitchTileFill } from "./SwitchStyleVisual";
import { choiceSx } from "../../skins/surfaceStyles";

/** A small picture of each switch style, switched on, to choose from. */
export function SwitchStylePicker({ value, onChange }: { value: SwitchStyleId; onChange: (id: SwitchStyleId) => void }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 1 }}>
      {SWITCH_STYLES.map((s) => {
        const selected = value === s.id;
        return (
          <ButtonBase
            key={s.id}
            onClick={() => onChange(s.id)}
            aria-pressed={selected}
            title={s.hint}
            sx={[
              {
              display: "grid",
              gridTemplateRows: "64px auto",
              justifyItems: "center",
              gap: 0.75,
              px: 1,
              py: 1,
            },
            choiceSx(selected),
          ]}
          >
            <Box sx={{ position: "relative", width: "100%", display: "grid", placeItems: "center", pointerEvents: "none" }}>
              {s.id === "toggle" ? (
                <Switch size="small" checked tabIndex={-1} />
              ) : s.id === "tile" ? (
                <Box sx={{ position: "relative", width: 72, height: 56, display: "grid", placeItems: "center" }}>
                  <SwitchTileFill on />
                  <Typography sx={{ position: "relative", color: "primary.main", fontWeight: "fontWeightBold" }}>On</Typography>
                </Box>
              ) : (
                <SwitchStyleVisual style={s.id} on fontSize={s.id === "cyber" || s.id === "lever" || s.id === "rocker" ? "8.5px" : "9.5px"} />
              )}
            </Box>
            <Typography variant="caption" fontWeight="fontWeightBold" textAlign="center">
              {s.label}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}
