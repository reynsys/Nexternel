import { Box, Stack, Typography } from "@mui/material";
import { usePanelContent } from "./use-panel-content";


/** One line of the plugin's text: "- " lines become bullet points, others stay paragraphs. */
function Line({ text }: { text: string }) {
  const bullet = /^\s*[-•*]\s+/.test(text);
  return (
    <Typography
      variant="body2"
      component="p"
      // Bullets hang: the dot sits in the margin and wrapped lines align with the text.
      sx={{ m: 0, pl: bullet ? 2 : 0, textIndent: bullet ? "-0.9em" : 0, wordBreak: "break-word" }}
    >
      {bullet ? `•\u2002${text.replace(/^\s*[-•*]\s+/, "")}` : text}
    </Typography>
  );
}

/** Text building block for plugin panels: shows what the plugin last wrote (e.g. a summary). */
export function TextPanel({ pluginId, panelId, label, extensionName }: { pluginId: string; panelId: string; label: string; extensionName: string }) {
  const { content, loaded } = usePanelContent(pluginId, panelId);

  if (!loaded) return null;
  if (!content || (!content.body && !content.title)) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
        Nothing yet. The {label.toLowerCase()} appears here when {extensionName} writes it.
      </Typography>
    );
  }

  const lines = content.body.split(/\r?\n/).filter((l) => l.trim());
  return (
    <Stack spacing={1} sx={{ p: 1.5, height: "100%", minHeight: 0, overflowY: "auto", width: "100%" }}>
      {content.title ? (
        <Typography variant="subtitle2" sx={{ fontWeight: "fontWeightBold" }}>
          {content.title}
        </Typography>
      ) : null}
      <Box sx={{ display: "grid", gap: 0.5 }}>
        {lines.map((l, i) => (
          <Line key={i} text={l} />
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary">
        Written {new Date(content.updatedAt).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
      </Typography>
    </Stack>
  );
}
