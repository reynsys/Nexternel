import { ToggleButton, ToggleButtonGroup } from "@mui/material";

/** One choice out of a few, as a row of buttons (the chosen one filled). */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <ToggleButtonGroup exclusive size="small" value={value} disabled={disabled} aria-label={label} onChange={(_, v: T | null) => v !== null && onChange(v)} sx={{ flexWrap: "wrap" }}>
      {options.map((o) => (
        <ToggleButton key={String(o.value)} value={o.value} sx={{ px: 1.5 }}>
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
