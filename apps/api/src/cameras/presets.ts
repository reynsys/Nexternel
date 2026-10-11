/** RTSP path templates for common CCTV brands (sub-stream preferred for dashboards). */

export type CameraBrandPreset = {
  id: string;
  label: string;
  /** Path after host:port — may include query string */
  pathTemplate: string;
  hint: string;
};

export const CAMERA_BRAND_PRESETS: CameraBrandPreset[] = [
  {
    id: "reolink-sub",
    label: "Reolink (sub)",
    pathTemplate: "/h264Preview_01_sub",
    hint: "Path /h264Preview_01_sub — enter host, username, password separately",
  },
  {
    id: "reolink-main",
    label: "Reolink (main)",
    pathTemplate: "/h264Preview_01_main",
    hint: "Path /h264Preview_01_main",
  },
  {
    id: "hikvision-sub",
    label: "Hikvision (sub ch1)",
    pathTemplate: "/Streaming/Channels/102",
    hint: "Path /Streaming/Channels/102 (sub)",
  },
  {
    id: "hikvision-main",
    label: "Hikvision (main ch1)",
    pathTemplate: "/Streaming/Channels/101",
    hint: "Path /Streaming/Channels/101 (main)",
  },
  {
    id: "dahua-sub",
    label: "Dahua / Amcrest (sub)",
    pathTemplate: "/cam/realmonitor?channel=1&subtype=1",
    hint: "subtype=1 is sub-stream",
  },
  {
    id: "dahua-main",
    label: "Dahua / Amcrest (main)",
    pathTemplate: "/cam/realmonitor?channel=1&subtype=0",
    hint: "subtype=0 is main stream",
  },
  {
    id: "generic-ch-main",
    label: "Generic NVR /chXX/0 (main)",
    pathTemplate: "/ch01/0",
    hint: "/ch01/0 = camera 1 main (HD); use ch02/ch03 for other cams",
  },
  {
    id: "generic-ch-sub",
    label: "Generic NVR /chXX/1 (sub)",
    pathTemplate: "/ch01/1",
    hint: "/ch01/1 = camera 1 sub-stream (better for dashboard tiles)",
  },
  {
    id: "axis",
    label: "Axis",
    pathTemplate: "/axis-media/media.amp",
    hint: "Path /axis-media/media.amp",
  },
];

export { buildRtspUrl, normalizeRtspUrl } from "./connection.js";

export function normalizeStreamId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
