import {
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { BuilderComponent, BuilderComponentCatalogEntry } from "@nexternel/domain";

type Props = {
  component: BuilderComponent;
  catalogEntry: BuilderComponentCatalogEntry;
  gpioMax: number;
  onChange: (next: BuilderComponent) => void;
};

export function BuilderComponentFields({
  component,
  catalogEntry,
  gpioMax,
  onChange,
}: Props) {
  function patch(updates: Record<string, unknown>) {
    onChange({ ...component, ...updates } as BuilderComponent);
  }

  return (
    <Stack spacing={1.5}>
      {catalogEntry.fields.map((field) => {
        const raw = (component as Record<string, unknown>)[field.key];

        if (field.type === "select") {
          const value =
            typeof raw === "string"
              ? raw
              : typeof field.defaultValue === "string"
                ? field.defaultValue
                : field.options?.[0]?.value ?? "";
          return (
            <FormControl key={field.key} fullWidth size="small">
              <InputLabel id={`${component.id}-${field.key}`}>{field.label}</InputLabel>
              <Select
                labelId={`${component.id}-${field.key}`}
                label={field.label}
                value={value}
                onChange={(e) => patch({ [field.key]: e.target.value })}
              >
                {(field.options ?? []).map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
              {field.help && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {field.help}
                </Typography>
              )}
            </FormControl>
          );
        }

        if (field.type === "boolean") {
          const checked =
            typeof raw === "boolean"
              ? raw
              : typeof field.defaultValue === "boolean"
                ? field.defaultValue
                : false;
          return (
            <FormControlLabel
              key={field.key}
              control={
                <Switch
                  checked={checked}
                  onChange={(e) => patch({ [field.key]: e.target.checked })}
                />
              }
              label={field.label}
            />
          );
        }

        if (field.type === "number") {
          const num =
            typeof raw === "number"
              ? raw
              : typeof field.defaultValue === "number"
                ? field.defaultValue
                : "";
          return (
            <TextField
              key={field.key}
              label={field.label}
              type="number"
              size="small"
              fullWidth
              value={num}
              inputProps={{
                min: field.min ?? 0,
                max: field.max ?? gpioMax,
              }}
              helperText={field.help}
              onChange={(e) => {
                const next = e.target.value.trim();
                if (next === "") {
                  const cleared = { ...component } as Record<string, unknown>;
                  delete cleared[field.key];
                  onChange(cleared as BuilderComponent);
                  return;
                }
                patch({ [field.key]: Number(next) });
              }}
            />
          );
        }

        const text =
          typeof raw === "string"
            ? raw
            : typeof field.defaultValue === "string"
              ? field.defaultValue
              : "";
        return (
          <TextField
            key={field.key}
            label={field.label}
            size="small"
            fullWidth
            value={text}
            helperText={field.help}
            onChange={(e) => patch({ [field.key]: e.target.value })}
          />
        );
      })}
    </Stack>
  );
}
