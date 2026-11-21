import type { ComponentType, ReactNode } from "react";
import { Accordion, AccordionDetails, Box, Button, Stack, Tooltip, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { sectionSx } from "../skins/surfaceStyles";
import { useGradientActive } from "../skins/useSurfaceStyles";
import { LookDecor } from "../skins/looks/LookDecor";

/**
 * One dashboard section as the dashboard draws it: the Look's frame, the header (icon, name, what is
 * in it, the fold button) and the panels below. The dashboard and the Appearance preview both use it.
 */
export function DashboardSectionFrame({
  id,
  title,
  icon: Icon,
  panelCount,
  collapsed,
  titleHidden = false,
  tools,
  outlineSx,
  onCollapsedChange,
  children,
}: {
  id: string;
  /** The name to show (the dashboard gives "Untitled section" while editing one without a name). */
  title: string;
  icon: ComponentType<SvgIconProps>;
  /** How many panels it holds (shown as "4 panels"). */
  panelCount: number;
  collapsed: boolean;
  /** No title bar: just the frame round the panels (always open). */
  titleHidden?: boolean;
  /** Buttons shown while editing (Add panel, Section settings). */
  tools?: ReactNode;
  /** Extra outline, e.g. while the section's settings are open. */
  outlineSx?: SxProps<Theme>;
  onCollapsedChange: (collapsed: boolean) => void;
  children: ReactNode;
}) {
  const gradientActive = useGradientActive();
  return (
    // The Look's section frame (LookDecor) is drawn over the section's edges.
    <>
      <Accordion
        id={`dash-section-${id}`}
        expanded={titleHidden || !collapsed}
        onChange={(_e, expanded) => onCollapsedChange(!expanded)}
        disableGutters
        data-nx-role="section"
        sx={[
          {
            overflow: "hidden",
            "&:before": { display: "none" },
            minWidth: 0,
          },
          // The Look's dashboard section (border, corners, fill, shadow) and the room it keeps for a frame.
          sectionSx(gradientActive),
          ...(outlineSx ? (Array.isArray(outlineSx) ? outlineSx : [outlineSx]) : []),
        ]}
      >
        {/* The section's header (the Accordion's first child): name, panel count, and its buttons. */}
        <Box sx={{ display: titleHidden ? "none" : "block", px: 2, py: 1.25, containerType: "inline-size" }}>
          <Stack
            direction="row"
            alignItems="center"
            useFlexGap
            spacing={1.25}
            sx={{
              width: "100%",
              minWidth: 0,
              // A narrow section (phone): Add panel and Section settings, with their words, on a line of their own.
              "@container (max-width: 520px)": {
                flexWrap: "wrap",
                "& [data-nx-section-name]": { flex: "1 1 0" },
                "& [data-nx-section-tools]": { order: 10, flexBasis: "100%", "& > *": { flex: "1 1 0", minWidth: 0 } },
              },
            }}
          >
            <Icon color="primary" fontSize="small" />
            <Typography data-nx-section-name="" variant="h6" noWrap sx={{ minWidth: 0 }}>
              {title}
            </Typography>
            <Typography variant="caption" sx={{ flexShrink: 0, color: "text.secondary" }}>
              {panelCount ? `${panelCount} panel${panelCount === 1 ? "" : "s"}` : ""}
            </Typography>
            <Box sx={{ flex: 1 }} />
            {tools}
            {/* Fold / open: a real button like every other, with its name. */}
            <Tooltip title={collapsed ? "Open this section" : "Fold this section"}>
              <Button
                variant="outlined"
                aria-label={collapsed ? "Open this section" : "Fold this section"}
                aria-expanded={!collapsed}
                aria-controls={`dash-section-body-${id}`}
                onClick={() => onCollapsedChange(!collapsed)}
                sx={{ minWidth: 36, width: 36, height: 36, p: 0, flexShrink: 0 }}
              >
                {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
              </Button>
            </Tooltip>
          </Stack>
        </Box>
        <AccordionDetails id={`dash-section-body-${id}`} sx={{ pt: titleHidden ? 2 : 0, px: 2, pb: 2 }}>
          {children}
        </AccordionDetails>
      </Accordion>
      <LookDecor slot="section" />
    </>
  );
}
