import { forwardRef } from "react";
import { Stack, type StackProps } from "@mui/material";

/**
 * Buttons that sit together: a row (or column) with Nexternel's space between buttons
 * (--nx-control-gap: the Look's controlGap plus room for its button decoration). Every group of
 * buttons uses this, so spacing is set in one place (see lib/button-rows-guard.test.ts).
 */
export const ButtonRow = forwardRef<HTMLDivElement, Omit<StackProps, "spacing">>(function ButtonRow(
  { direction = "row", alignItems = "center", flexWrap = "wrap", sx, ...rest },
  ref
) {
  return (
    <Stack
      ref={ref}
      direction={direction}
      alignItems={alignItems}
      flexWrap={flexWrap}
      useFlexGap
      sx={[{ gap: "var(--nx-control-gap)" }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...rest}
    />
  );
});
