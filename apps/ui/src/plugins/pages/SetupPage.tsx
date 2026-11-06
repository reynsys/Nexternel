import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { api } from "../../api";
import { ButtonRow } from "../../components/ButtonRow";
import { copyTextToClipboard } from "../../lib/copyText";
import { contentSurfaceSx } from "../../skins/surfaceStyles";

type Field = { key: string; label: string; value?: string; secret?: boolean; help?: string };
type Part =
  | { text: string }
  | { link: string; label: string }
  | { copy: string; label: string };
type SetupStep = { title: string; parts: Part[]; fields?: Field[]; button?: string };
type Item = { name: string; detail: string; ok: boolean };
type View = {
  admin: boolean;
  /** Set once connected: what is working, and what can be done about it. */
  done?: { title: string; items: Item[]; note?: string; action?: { id: string; label: string } };
  steps: SetupStep[];
  step: number;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="small"
      variant="outlined"
      onClick={() => {
        void copyTextToClipboard(value).then((r) => {
          setCopied(r.ok);
          if (r.ok) window.setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

function StepPart({ part }: { part: Part }) {
  if ("text" in part) return <Typography variant="body2">{part.text}</Typography>;
  if ("copy" in part) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>{part.copy}</Typography>
        <Box sx={{ flex: "none" }}><CopyButton value={part.copy} label={part.label} /></Box>
      </Stack>
    );
  }
  return (
    <Box>
      <Button size="small" variant="outlined" component="a" href={part.link} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon />}>
        {part.label}
      </Button>
    </Box>
  );
}

function StepBody({ step, first, last, busy, onBack, onNext }: {
  step: SetupStep;
  first: boolean;
  last: boolean;
  busy: boolean;
  onBack: () => void;
  onNext: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((step.fields ?? []).map((f) => [f.key, f.value ?? ""]))
  );
  return (
    <Stack spacing={1.5}>
      {step.parts.map((part, i) => <StepPart key={i} part={part} />)}
      {(step.fields ?? []).map((f) => (
        <TextField
          key={f.key}
          size="small"
          fullWidth
          autoComplete="off"
          label={f.label}
          helperText={f.help}
          type={f.secret ? "password" : "text"}
          value={values[f.key] ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
        />
      ))}
      <ButtonRow>
        {first ? null : <Button variant="outlined" color="inherit" disabled={busy} onClick={onBack}>Back</Button>}
        <Button variant="contained" disabled={busy} onClick={() => onNext(values)}>
          {busy ? "Please wait…" : step.button ?? (last ? "Finish" : "Next")}
        </Button>
      </ButtonRow>
    </Stack>
  );
}

/**
 * A guided setup for something that needs steps on another company's website. The plugin says what
 * each step is; this page shows one at a time, and the plugin checks each step's answers.
 */
export function SetupPage({ pluginId, pageId, title }: { pluginId: string; pageId: string; title: string }) {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const call = useCallback(
    async (action: string, params: Record<string, unknown> = {}) => {
      setBusy(true);
      setMessage(null);
      try {
        setView(await api.pluginPageCall<View>(pluginId, pageId, action, params));
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "That did not work.");
      } finally {
        setBusy(false);
      }
    },
    [pluginId, pageId]
  );

  useEffect(() => {
    void call("view");
  }, [call]);

  const done = view?.done;
  const setup = view && !done ? view : null;
  return (
    <Stack spacing={2} sx={{ maxWidth: 720 }}>
      <Typography variant="h5" component="h1">{title}</Typography>
      {message ? <Alert severity="error">{message}</Alert> : null}
      {done ? (
        <Paper sx={{ ...contentSurfaceSx(), p: 2 }}>
          <Stack spacing={1.5}>
            <Typography sx={{ fontWeight: "fontWeightBold" }}>{done.title}</Typography>
            {done.items.map((item) => (
              <Stack key={item.name} direction="row" spacing={1} alignItems="center">
                {item.ok ? <CheckCircleOutlineIcon color="success" fontSize="small" /> : <ErrorOutlineIcon color="warning" fontSize="small" />}
                <Typography variant="body2">{item.name}: {item.detail}</Typography>
              </Stack>
            ))}
            {done.note ? <Typography variant="body2" color="text.secondary">{done.note}</Typography> : null}
            {done.action && view?.admin ? (
              <Box><Button variant="outlined" disabled={busy} onClick={() => void call(done.action!.id)}>{done.action.label}</Button></Box>
            ) : null}
          </Stack>
        </Paper>
      ) : null}
      {setup && !setup.admin ? <Alert severity="info">An administrator needs to set this up.</Alert> : null}
      {setup?.admin ? (
        <Paper sx={{ ...contentSurfaceSx(), p: 2 }}>
          <Stepper orientation="vertical" activeStep={setup.step}>
            {setup.steps.map((step, i) => (
              <Step key={step.title}>
                <StepLabel>{step.title}</StepLabel>
                <StepContent>
                  {/* The key keeps each step's boxes its own when the plugin answers. */}
                  <StepBody
                    key={setup.step}
                    step={step}
                    first={i === 0}
                    last={i === setup.steps.length - 1}
                    busy={busy}
                    onBack={() => void call("back")}
                    onNext={(values) => void call("next", { values })}
                  />
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </Paper>
      ) : null}
    </Stack>
  );
}
