import { useState } from "react";
import { Alert, Box, Button, ButtonBase, Stack, TextField, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import type { FoundPlace } from "../api";
import { choiceSx } from "../skins/surfaceStyles";

/** A chosen place: the short name shown on panels, where it is, and the line that tells it apart. */
export type ChosenPlace = { name: string; latitude: number; longitude: number; label?: string };

/**
 * Choose a place by typing a town or postcode and picking from the list (several towns share a name).
 * No coordinates on screen. Used by the setup wizard and the weather panel's settings: one way to
 * choose a place everywhere. `search` is the place search the screen may use (before or after sign-in).
 */
export function PlaceSearch({
  value,
  onChange,
  search,
  label = "Town or postcode",
  disabled,
}: {
  value: ChosenPlace | null;
  onChange: (place: ChosenPlace | null) => void;
  search: (q: string) => Promise<{ results: FoundPlace[] }>;
  label?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundPlace[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function find() {
    const q = query.trim();
    if (q.length < 2) {
      setError("Type at least 2 letters of the town or postcode.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { results: found } = await search(q);
      setResults(found);
      if (found.length === 0) setError(`No place called “${q}” was found. Check the spelling, or try a bigger town nearby.`);
    } catch (err) {
      setResults(null);
      setError(err instanceof Error ? err.message : "The place search is not answering right now.");
    } finally {
      setBusy(false);
    }
  }

  const chosenText = value ? value.label || value.name : null;
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          label={label}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void find();
            }
          }}
          fullWidth
          disabled={disabled || busy}
          autoComplete="off"
          helperText={chosenText ? `Chosen: ${chosenText}` : "Type it, then press Find."}
        />
        <Button variant="outlined" onClick={() => void find()} disabled={disabled || busy} sx={{ flexShrink: 0, mt: "8px" }}>
          {busy ? "Finding…" : "Find"}
        </Button>
      </Stack>
      {error && <Alert severity="warning">{error}</Alert>}
      {results && results.length > 0 && (
        <Stack spacing={0.75} role="listbox" aria-label="Places found">
          {results.map((r) => {
            const selected = !!value && value.latitude === r.latitude && value.longitude === r.longitude;
            const rest = [r.admin1, r.country].filter(Boolean).join(", ");
            return (
              <ButtonBase
                key={`${r.latitude},${r.longitude}`}
                role="option"
                aria-selected={selected}
                onClick={() => onChange({ name: r.name, latitude: r.latitude, longitude: r.longitude, label: r.label })}
                sx={[{ justifyContent: "space-between", textAlign: "left", px: 1.5, py: 1, gap: 1 }, choiceSx(selected)]}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight="fontWeightBold">{r.name}</Typography>
                  {rest ? <Typography variant="caption" color="text.secondary">{rest}</Typography> : null}
                </Box>
                {selected ? <CheckRoundedIcon color="primary" fontSize="small" /> : null}
              </ButtonBase>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
