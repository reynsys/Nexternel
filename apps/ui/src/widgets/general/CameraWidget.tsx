import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import Hls from "hls.js";
import { api, type WidgetInstance } from "../../api";
import { generalWidgetHeading, parseCameraConfig } from "./config";
import { useDashboardTileChrome } from "../../lib/dashboard-tile-context";

type PlayUrls = { hlsUrl: string; mseUrl: string; name: string };

/** One cameraPlay + attach at a time across all tiles (NVR session limit). */
let clientPlayTail: Promise<void> = Promise.resolve();

function enqueueClientPlay<T>(fn: () => Promise<T>): Promise<T> {
  const run = clientPlayTail.then(fn, fn);
  clientPlayTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForVideoPlaying(
  video: HTMLVideoElement,
  timeoutMs: number,
  isCancelled: () => boolean
): Promise<boolean> {
  return new Promise((resolve) => {
    if (video.videoWidth > 0 && !video.paused) {
      resolve(true);
      return;
    }
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("loadeddata", onLoaded);
      clearTimeout(timer);
      resolve(ok);
    };
    const onPlaying = () => {
      if (isCancelled()) {
        finish(false);
        return;
      }
      if (video.videoWidth > 0) finish(true);
    };
    const onLoaded = () => {
      if (!isCancelled() && video.videoWidth > 0 && !video.paused) finish(true);
    };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("loadeddata", onLoaded);
    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}

export function CameraWidget({ widget }: { widget: WidgetInstance }) {
  const { cameraId, embeddedInPanel } = parseCameraConfig(widget.config);
  const { showBodyHeading } = useDashboardTileChrome();
  const showHeading = showBodyHeading && !embeddedInPanel;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [title, setTitle] = useState(generalWidgetHeading(widget, "Camera"));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryToken, setRetryToken] = useState(0);
  const [statusHint, setStatusHint] = useState("Connecting…");

  useEffect(() => {
    setTitle(generalWidgetHeading(widget, "Camera"));
  }, [widget.title, widget.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!cameraId || !video) {
      setLoading(false);
      setError(cameraId ? null : "Select a camera in Edit");
      return;
    }

    let hls: Hls | null = null;
    let cancelled = false;
    let remountTimer: ReturnType<typeof setTimeout> | null = null;
    let networkRetries = 0;

    setLoading(true);
    setError(null);
    setStatusHint("Waiting for camera slot…");

    function clearMedia() {
      if (hls) {
        hls.destroy();
        hls = null;
      }
      if (video) {
        video.removeAttribute("src");
        video.load();
      }
    }

    function scheduleFullRetry(reason: string) {
      if (cancelled) return;
      setError(reason);
      setLoading(false);
      remountTimer = setTimeout(() => {
        if (!cancelled) setRetryToken((n) => n + 1);
      }, 5000);
    }

    function markLive() {
      if (cancelled) return;
      setLoading(false);
      setError(null);
      setStatusHint("");
    }

    async function attachMse(play: PlayUrls): Promise<boolean> {
      if (!video || cancelled) return false;
      setStatusHint("Starting live stream…");
      video.src = play.mseUrl;
      void video.play().catch(() => {
        /* muted autoplay */
      });
      const ok = await waitForVideoPlaying(video, 18_000, () => cancelled);
      if (ok) {
        markLive();
        return true;
      }
      return false;
    }

    async function attachHls(play: PlayUrls): Promise<boolean> {
      if (!video || cancelled) return false;
      setStatusHint("Starting HLS…");

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = play.hlsUrl;
        void video.play().catch(() => {
          /* muted autoplay */
        });
        const ok = await waitForVideoPlaying(video, 18_000, () => cancelled);
        if (ok) {
          markLive();
          return true;
        }
        return false;
      }

      if (!Hls.isSupported()) return false;

      return await new Promise<boolean>((resolve) => {
        if (!video || cancelled) {
          resolve(false);
          return;
        }

        let settled = false;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(failTimer);
          if (ok) markLive();
          else clearMedia();
          resolve(ok);
        };

        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 20,
          liveSyncDurationCount: 3,
          manifestLoadingMaxRetry: 8,
          levelLoadingMaxRetry: 8,
          fragLoadingMaxRetry: 10,
          manifestLoadingTimeOut: 25000,
          fragLoadingTimeOut: 25000,
        });
        hls.loadSource(play.hlsUrl);
        hls.attachMedia(video);

        const failTimer = setTimeout(() => {
          if (cancelled) {
            finish(false);
            return;
          }
          finish(false);
        }, 22_000);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;
          setStatusHint("Buffering video…");
          void video.play().catch(() => {
            /* muted autoplay */
          });
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          if (cancelled || !video) return;
          // Do not clear loading yet — wait until pixels are decoding.
          if (video.videoWidth > 0) finish(true);
        });

        video.addEventListener(
          "playing",
          () => {
            if (cancelled) return;
            if (video.videoWidth > 0) finish(true);
          },
          { once: true }
        );

        hls.on(Hls.Events.ERROR, (_ev, data) => {
          if (cancelled || !data.fatal || !hls || settled) return;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 8) {
            networkRetries += 1;
            setStatusHint(`Reconnecting (${networkRetries})…`);
            setTimeout(() => {
              if (!cancelled && hls) hls.startLoad();
            }, 800 * networkRetries);
            return;
          }

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            try {
              hls.recoverMediaError();
              return;
            } catch {
              /* fall through */
            }
          }

          finish(false);
        });
      });
    }

    void (async () => {
      try {
        await enqueueClientPlay(async () => {
          if (cancelled) return;
          setStatusHint("Opening stream…");
          const { play } = await api.cameraPlay(cameraId);
          if (cancelled) return;
          setTitle(generalWidgetHeading(widget, play.name));

          // MSE first — go2rtc live HLS is flaky; fMP4 MSE handles NVR H.264 better.
          const mseOk = await attachMse(play);
          if (cancelled || mseOk) {
            // Brief gap before next tile starts its RTSP open.
            await sleep(1500);
            return;
          }

          clearMedia();
          const hlsOk = await attachHls(play);
          if (cancelled) return;
          if (!hlsOk) {
            scheduleFullRetry("Stream slow to start — retrying…");
          }
          await sleep(1500);
        });
      } catch (err) {
        if (!cancelled) {
          scheduleFullRetry(
            err instanceof Error ? err.message : "Failed to load stream"
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (remountTimer) clearTimeout(remountTimer);
      clearMedia();
    };
  }, [cameraId, widget.id, retryToken]);

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        gap: 0.5,
      }}
    >
      {showHeading && (
        <Typography variant="subtitle2" noWrap title={title} sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      )}
      {error ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <Alert severity="warning" sx={{ py: 0.5, flex: 1 }}>
            {error}
          </Alert>
          {cameraId ? (
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setRetryToken((n) => n + 1);
              }}
            >
              Retry
            </Button>
          ) : null}
        </Stack>
      ) : null}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          bgcolor: "common.black",
          position: "relative",
        }}
      >
        {loading && !error && (
          <Typography
            variant="caption"
            color="grey.400"
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
              px: 1,
              textAlign: "center",
            }}
          >
            {statusHint}
          </Typography>
        )}
        <Box
          component="video"
          ref={videoRef}
          muted
          autoPlay
          playsInline
          controls
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: error ? "none" : "block",
          }}
        />
      </Box>
    </Box>
  );
}
