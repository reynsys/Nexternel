import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Box, Stack, Typography } from "@mui/material";
import { ButtonRow } from "./ButtonRow";

/**
 * The top of every page, drawn the same everywhere: the title with one line saying what the page is
 * for on the left, the page's main buttons on the right (under the title on a narrow screen).
 */
export function PageHeader({ title, hint, actions, actionsRef }: { title: ReactNode; hint?: ReactNode; actions?: ReactNode; actionsRef?: (el: HTMLDivElement | null) => void }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" useFlexGap gap={1.5}>
      <Box sx={{ minWidth: 0, flex: "1 1 320px" }}>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        {hint ? (
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            {hint}
          </Typography>
        ) : null}
      </Box>
      <ButtonRow ref={actionsRef} direction="row" flexWrap="wrap" useFlexGap sx={{ "&:empty": { display: "none" } }}>
        {actions}
      </ButtonRow>
    </Stack>
  );
}

const SlotContext = createContext<HTMLDivElement | null>(null);

/** A page drawn by a layout (Settings): the layout's header, with a place for the page's own buttons. */
export function PageHeaderWithSlot({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  return (
    <SlotContext.Provider value={slot}>
      <Box sx={{ mb: 2 }}>
        <PageHeader title={title} hint={hint} actionsRef={setSlot} />
      </Box>
      {children}
    </SlotContext.Provider>
  );
}

/** Puts a page's main buttons on the right of the layout's header. */
export function PageActions({ children }: { children: ReactNode }) {
  const slot = useContext(SlotContext);
  return slot ? createPortal(children, slot) : null;
}
