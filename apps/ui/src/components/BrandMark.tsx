import Box from "@mui/material/Box";

/**
 * The Nexternel mark (or the owner's own logo) at the top of the menu, the phone bar and
 * Settings. Without an own logo it is drawn from the Look's brand role.
 */
export function BrandMark({ logo, size = 28 }: { logo: string | null; size?: number }) {
  if (logo) {
    return (
      <Box
        component="img"
        src={logo}
        alt="Brand"
        sx={(t) => ({
          width: size,
          height: size,
          borderRadius: t.nx.brandRadius,
          objectFit: "cover",
          border: `1px solid ${t.palette.divider}`,
          display: "block",
          flexShrink: 0,
        })}
      />
    );
  }
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
