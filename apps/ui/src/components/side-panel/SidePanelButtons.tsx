import { Button } from "@mui/material";
import { ButtonRow } from "../ButtonRow";

/**
 * The bottom of every side menu in the dashboard editor: Cancel and Apply, side by side. Changes
 * show on the dashboard while they are made; Apply keeps them, Cancel puts back how it was when the
 * menu opened. (The dashboard's own Save, at the top, stores the whole dashboard.)
 */
export function SidePanelButtons({ onCancel, onApply, applyDisabled = false, cancelDisabled = false }: { onCancel: () => void; onApply: () => void; applyDisabled?: boolean; cancelDisabled?: boolean }) {
  return (
    <ButtonRow direction="row" flexWrap="nowrap">
      <Button variant="outlined" onClick={onCancel} fullWidth disabled={cancelDisabled}>
        Cancel
      </Button>
      <Button variant="contained" onClick={onApply} fullWidth disabled={applyDisabled}>
        Apply
      </Button>
    </ButtonRow>
  );
}
