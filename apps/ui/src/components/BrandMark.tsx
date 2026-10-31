import Box from "@mui/material/Box";

/**
 * The Nexternel mark at the top of the menu and the phone bar, drawn from the Look's brand role.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <Box
      aria-hidden
      sx={(t) => ({
        width: size,
        height: size,
        borderRadius: t.nx.brandRadius,
        background: t.nx.brandFill,
        border: t.nx.brandBorder || "none",
        boxShadow: t.nx.brandShadow || "none",
        flexShrink: 0,
      })}
    />
  );
}
