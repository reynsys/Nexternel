import { useEffect, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { api } from "../../api";

type Content = { title: string; body: string; updatedAt: string };

const REFRESH_MS = 60_000;

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
export function TextPanel({ pluginId, panelId, label }: { pluginId: string; panelId: string; label: string }) {
  const [content, setContent] = useState<Content | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .pluginPanelContent(pluginId, panelId)
        .then((r) => {
          if (!alive) return;
          setContent(r.content);
          setLoaded(true);
        })
        .catch(() => alive && setLoaded(true));
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pluginId, panelId]);

  if (!loaded) return null;
  if (!content || (!content.body && !content.title)) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
        Nothing yet. The {label.toLowerCase()} appears here when the plugin writes it.
      </Typography>
    );
  }

  const lines = content.body.split(/\r?\n/).filter((l) => l.trim());
  return (
    <Stack spacing={1} sx={{ p: 1.5, height: "100%", minHeight: 0, overflowY: "auto", width: "100%" }}>
      {content.title ? (
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
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
