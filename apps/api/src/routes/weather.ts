import type { FastifyPluginAsync } from "fastify";
import { requireUser } from "../auth/plugin.js";

const WMO: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Slight rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Slight snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm + hail",
  99: "Thunderstorm + heavy hail",
};

function wmoDescription(code: number): string {
  return WMO[code] || "Unknown";
}

function isPrecipCode(code: number): boolean {
  return (
    (code >= 51 && code <= 67) ||
    (code >= 71 && code <= 77) ||
    (code >= 80 && code <= 86) ||
    code >= 95
  );
}

function isSkyCode(code: number): boolean {
  return code <= 3 || (code >= 45 && code <= 48);
}

/** Most common code in a list (ties → first seen). */
function modeCode(codes: number[]): number | null {
  if (codes.length === 0) return null;
  const counts = new Map<number, number>();
  let best = codes[0]!;
  let bestN = 0;
  for (const c of codes) {
    const n = (counts.get(c) ?? 0) + 1;
    counts.set(c, n);
    if (n > bestN) {
      best = c;
      bestN = n;
    }
  }
  return best;
}

/**
 * Open-Meteo daily weather_code is often the *most severe* hour of the day
 * (e.g. 0.3 mm evening drizzle → whole day “drizzle”). Met Office website
 * presents the daytime picture. Prefer daytime sky when rain is negligible.
 */
function dayDisplayCode(opts: {
  dailyCode: number;
  rainMm: number;
  daytimeCodes: number[];
}): number {
  const { dailyCode, rainMm, daytimeCodes } = opts;
  const skyFromDay =
    modeCode(daytimeCodes.filter((c) => isSkyCode(c))) ??
    modeCode(daytimeCodes) ??
    null;

  // Trace / negligible precip — don't show rain for the whole day
  if (rainMm < 0.5 && isPrecipCode(dailyCode)) {
    return skyFromDay ?? Math.min(dailyCode, 3);
  }

  // Light rain day — keep a light precip symbol if model says so
  if (rainMm >= 0.5 && rainMm < 1.5 && isPrecipCode(dailyCode)) {
    if (dailyCode >= 80) return 80;
    if (dailyCode >= 71) return 71;
    return 51;
  }

  return dailyCode;
}

function hourLocal(iso: string): number {
  // "2026-08-01T14:00" → 14
  const m = /T(\d{2})/.exec(iso);
  return m ? Number(m[1]) : 12;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export const weatherRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/weather/geocode", async (request, reply) => {
    if (!requireUser(request, reply)) return;

    const q = request.query as { q?: string };
    const name = typeof q.q === "string" ? q.q.trim() : "";
    if (name.length < 2) {
      return reply.code(400).send({
        error: { code: "validation_error", message: "q must be at least 2 characters" },
      });
    }

    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", name);
    url.searchParams.set("count", "5");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    try {
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        return reply.code(502).send({
          error: { code: "upstream_error", message: "Geocoding unavailable" },
        });
      }
      const data = (await res.json()) as {
        results?: Array<{
          name?: string;
          latitude?: number;
          longitude?: number;
          country?: string;
          admin1?: string;
          timezone?: string;
        }>;
      };
      const results = (data.results ?? [])
        .filter(
          (r) =>
            typeof r.latitude === "number" &&
            typeof r.longitude === "number" &&
            typeof r.name === "string"
        )
        .map((r) => ({
          name: r.name!,
          latitude: r.latitude!,
          longitude: r.longitude!,
          country: r.country ?? "",
          admin1: r.admin1 ?? "",
          timezone: r.timezone ?? "",
          label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
        }));
      return { results };
    } catch (err) {
      request.log.warn({ err }, "weather geocode failed");
      return reply.code(502).send({
        error: { code: "upstream_error", message: "Geocoding unavailable" },
      });
    }
  });

  app.get("/api/v1/weather", async (request, reply) => {
    if (!requireUser(request, reply)) return;

    const q = request.query as { lat?: string; lon?: string };
    const lat = Number(q.lat ?? 51.5074);
    const lon = Number(q.lon ?? -0.1278);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return reply.code(400).send({
        error: { code: "validation_error", message: "lat and lon must be numbers" },
      });
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return reply.code(400).send({
        error: { code: "validation_error", message: "lat/lon out of range" },
      });
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation"
    );
    url.searchParams.set(
      "hourly",
      "weather_code,precipitation,wind_speed_10m,temperature_2m"
    );
    url.searchParams.set(
      "daily",
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,precipitation_probability_max,wind_speed_10m_max"
    );
    url.searchParams.set("forecast_days", "6");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("temperature_unit", "celsius");
    url.searchParams.set("timezone", "auto");
    // UKMO model fields via Open-Meteo (not a 1:1 Met Office website feed).
    // Icons are Open-Meteo WMO codes — we re-derive day icons from daytime + rain sum.
    if (lat >= 49.5 && lat <= 61 && lon >= -11 && lon <= 2.5) {
      url.searchParams.set("models", "ukmo_seamless");
    } else {
      url.searchParams.set("models", "best_match");
    }

    try {
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return reply.code(502).send({
          error: { code: "upstream_error", message: "Weather service unavailable" },
        });
      }

      const data = (await res.json()) as {
        latitude?: number;
        longitude?: number;
        timezone?: string;
        current?: {
          temperature_2m?: number;
          relative_humidity_2m?: number;
          weather_code?: number;
          wind_speed_10m?: number;
          precipitation?: number;
          time?: string;
        };
        hourly?: {
          time?: string[];
          weather_code?: number[];
          precipitation?: number[];
          wind_speed_10m?: number[];
        };
        daily?: {
          time?: string[];
          weather_code?: number[];
          temperature_2m_max?: number[];
          temperature_2m_min?: number[];
          precipitation_sum?: number[];
          rain_sum?: number[];
          precipitation_probability_max?: number[];
          wind_speed_10m_max?: number[];
        };
      };

      const current = data.current;
      const code = current?.weather_code ?? 0;
      const daily = data.daily;
      const hourly = data.hourly;

      const daytimeByDay = new Map<string, number[]>();
      const times = hourly?.time ?? [];
      for (let i = 0; i < times.length; i++) {
        const t = times[i]!;
        const h = hourLocal(t);
        // Daytime window Met Office-style (morning–evening)
        if (h < 7 || h > 20) continue;
        const key = dayKey(t);
        const list = daytimeByDay.get(key) ?? [];
        list.push(hourly?.weather_code?.[i] ?? 0);
        daytimeByDay.set(key, list);
      }

      const forecast =
        daily?.time?.map((date, i) => {
          const rawCode = daily.weather_code?.[i] ?? 0;
          const rainMm = Math.max(
            daily.rain_sum?.[i] ?? 0,
            daily.precipitation_sum?.[i] ?? 0
          );
          const displayCode = dayDisplayCode({
            dailyCode: rawCode,
            rainMm,
            daytimeCodes: daytimeByDay.get(date) ?? [],
          });
          return {
            date,
            weatherCode: displayCode,
            description: wmoDescription(displayCode),
            tempMax: daily.temperature_2m_max?.[i],
            tempMin: daily.temperature_2m_min?.[i],
            precipMm: rainMm,
            precipProbability: daily.precipitation_probability_max?.[i] ?? null,
            windMax: daily.wind_speed_10m_max?.[i],
          };
        }) ?? [];

      return {
        temperature: current?.temperature_2m,
        humidity: current?.relative_humidity_2m,
        windSpeed: current?.wind_speed_10m,
        weatherCode: code,
        description: wmoDescription(code),
        time: current?.time,
        requestedLatitude: lat,
        requestedLongitude: lon,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
        source: "open-meteo-ukmo",
        forecast,
      };
    } catch (err) {
      request.log.warn({ err }, "weather fetch failed");
      return reply.code(502).send({
        error: { code: "upstream_error", message: "Weather service unavailable" },
      });
    }
  });
};
