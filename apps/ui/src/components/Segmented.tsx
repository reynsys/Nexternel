import type { ReactNode } from "react";
import { Button } from "@mui/material";
import { ButtonRow } from "./ButtonRow";

/**
 * One choice out of a few short words (Light / Dark / Automatic, Few / Normal / Many…): separate
 * buttons in the Look's own button shape, the chosen one filled. Every word choice in Nexternel uses
 * this, so they all look alike; choices with a picture use ChoiceTile, and tabs stay a bar.
 */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  /** null: none chosen yet (e.g. panels of different widths). */
  value: T | null;
  options: readonly { value: T; label: ReactNode; icon?: ReactNode; disabled?: boolean }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <ButtonRow role="group" aria-label={label}>
      {options.map((o) => {
        const chosen = o.value === value;
        return (
          <Button
            key={String(o.value)}
            variant={chosen ? "contained" : "outlined"}
            aria-pressed={chosen}
            startIcon={o.icon}
            disabled={disabled || o.disabled}
            onClick={() => !chosen && onChange(o.value)}
          >
            {o.label}
          </Button>
        );
      })}
    </ButtonRow>
  );
}
