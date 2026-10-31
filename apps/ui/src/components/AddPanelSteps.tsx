import { Box, Typography } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { ICON_SIZE } from "../lib/appearance/type";
import { choiceSx } from "../skins/surfaceStyles";

/**
 * The three steps of Add panel, always in sight above the menu: 1 what kind, 2 what it shows,
 * 3 how it looks. The current one is filled, done ones are ticked; a panel that has nothing to
 * choose (a clock) says "Not needed" on step 2.
 */
export function AddPanelSteps({ step, typeLabel, hasContent }: { step: 1 | 2 | 3; typeLabel: string | null; hasContent: boolean }) {
  const steps: { n: 1 | 2 | 3; label: string }[] = [
    { n: 1, label: step > 1 && typeLabel ? typeLabel : "What kind" },
    { n: 2, label: step > 1 && !hasContent ? "Not needed" : "What it shows" },
    { n: 3, label: "Look" },
  ];
  return (
    <Box component="ol" aria-label="Steps" sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 0.75, m: 0, mb: 1, p: 0, listStyle: "none" }}>
      {steps.map((s) => {
        const current = s.n === step;
        const done = s.n < step;
        return (
          <Box
            component="li"
            key={s.n}
            aria-current={current ? "step" : undefined}
            sx={[
              {
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                minWidth: 0,
                px: 1,
                py: 0.5,
                color: current || done ? "primary.main" : "text.secondary",
              },
              // The Look's choice style: the current step is the chosen one.
              choiceSx(current, { radius: "field" }),
            ]}
          >
            {done ? <CheckIcon sx={{ fontSize: ICON_SIZE.inline, flexShrink: 0 }} /> : null}
            <Typography variant="caption" noWrap fontWeight={current ? "fontWeightBold" : undefined}>
              {s.n} · {s.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
