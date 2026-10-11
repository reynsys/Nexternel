const GRAPHQL_URL = "https://api.octopus.energy/v1/graphql/";

export type OctopusToken = {
  token: string;
  refreshToken: string;
  refreshExpiresAt: number;
  expiresAt: number;
};

/** UK standard volume correction (temperature / pressure). */
export const GAS_VOLUME_CORRECTION = 1.02264;
/** Typical UK gas calorific value (MJ/m³) when API does not supply one. */
export const GAS_DEFAULT_CALORIFIC_MJ_PER_M3 = 39.2;

export type GasMeterDiscovery = {
  deviceId: string | null;
  consumptionUnits: string | null;
};

export type OctopusTelemetryPoint = {
  readAt: string;
  demand: number | string | null;
  consumptionDelta: number | string | null;
  consumption: number | string | null;
};

/** Octopus GraphQL often returns numeric fields as strings — parse safely. */
export function parseOctopusNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

type GraphqlResponse<T> = {
  data?: T;
  errors?: { message?: string }[];
};

let cachedToken: OctopusToken | null = null;

function nowMs(): number {
  return Date.now();
}

async function graphqlRequest<T>(
  query: string,
  opts?: { token?: string; integrationContext?: string }
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts?.token) {
    headers.Authorization = `JWT ${opts.token}`;
  }
  if (opts?.integrationContext) {
    headers["Octopus-Energy-Integration-Name"] = opts.integrationContext;
  }

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(
        "Octopus rate limit — wait a minute before testing again (~100 API calls/hour)."
      );
    }
    throw new Error(`Octopus API HTTP ${res.status}`);
  }

  const body = (await res.json()) as GraphqlResponse<T>;
  if (body.errors?.length) {
    const msg = body.errors.map((e) => e.message ?? "GraphQL error").join("; ");
    if (/too many requests/i.test(msg)) {
      throw new Error(
        "Octopus rate limit — wait a minute before testing again (~100 API calls/hour)."
      );
    }
    throw new Error(msg);
  }
  if (!body.data) {
    throw new Error("Octopus API returned no data");
  }
  return body.data;
}

export async function obtainKrakenToken(apiKey: string): Promise<OctopusToken> {
  const escaped = apiKey.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const query = `mutation { obtainKrakenToken(input: { APIKey: "${escaped}" }) { token refreshToken refreshExpiresIn } }`;
  const data = await graphqlRequest<{
    obtainKrakenToken: {
      token: string;
      refreshToken: string;
      refreshExpiresIn: number;
    };
  }>(query, { integrationContext: "nexternel-token" });

  const row = data.obtainKrakenToken;
  return {
    token: row.token,
    refreshToken: row.refreshToken,
    refreshExpiresAt: row.refreshExpiresIn * 1000,
    expiresAt: nowMs() + 55 * 60 * 1000,
  };
}

export async function refreshKrakenToken(refreshToken: string): Promise<OctopusToken> {
  const escaped = refreshToken.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const query = `mutation { obtainKrakenToken(input: { refreshToken: "${escaped}" }) { token refreshToken refreshExpiresIn } }`;
  const data = await graphqlRequest<{
    obtainKrakenToken: {
      token: string;
      refreshToken: string;
      refreshExpiresIn: number;
    };
  }>(query, { integrationContext: "nexternel-refresh" });

  const row = data.obtainKrakenToken;
  return {
    token: row.token,
    refreshToken: row.refreshToken,
    refreshExpiresAt: row.refreshExpiresIn * 1000,
    expiresAt: nowMs() + 55 * 60 * 1000,
  };
}

export async function getValidToken(apiKey: string): Promise<string> {
  if (
    cachedToken &&
    cachedToken.expiresAt > nowMs() + 60_000 &&
    cachedToken.refreshExpiresAt > nowMs()
  ) {
    return cachedToken.token;
  }

  if (cachedToken && cachedToken.refreshExpiresAt > nowMs()) {
    try {
      cachedToken = await refreshKrakenToken(cachedToken.refreshToken);
      return cachedToken.token;
    } catch {
      cachedToken = null;
    }
  }

  cachedToken = await obtainKrakenToken(apiKey);
  return cachedToken.token;
}

export function clearOctopusTokenCache(): void {
  cachedToken = null;
}

export async function discoverElectricityDeviceId(
  apiKey: string,
  accountNumber: string
): Promise<string | null> {
  const token = await getValidToken(apiKey);
  const account = accountNumber.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const query = `query {
    account(accountNumber: "${account}") {
      electricityAgreements(active: true) {
        meterPoint {
          direction
          meters(includeInactive: false) {
            serialNumber
            smartDevices { deviceId }
            smartImportElectricityMeter { deviceId }
            smartExportElectricityMeter { deviceId }
          }
        }
      }
    }
  }`;

  const data = await graphqlRequest<{
    account: {
      electricityAgreements: {
        meterPoint: {
          direction: string | null;
          meters: {
            serialNumber: string;
            smartDevices: { deviceId: string }[] | null;
            smartImportElectricityMeter: { deviceId: string } | null;
            smartExportElectricityMeter: { deviceId: string } | null;
          }[];
        };
      }[];
    } | null;
  }>(query, { token, integrationContext: "nexternel-discover" });

  const agreements = data.account?.electricityAgreements ?? [];
  for (const agreement of agreements) {
    const mp = agreement.meterPoint;
    if (mp.direction === "EXPORT") continue;
    for (const meter of mp.meters) {
      for (const device of meter.smartDevices ?? []) {
        if (device.deviceId) return device.deviceId;
      }
      const id = meter.smartImportElectricityMeter?.deviceId;
      if (id) return id;
    }
  }
  return null;
}

export async function discoverGasDeviceId(
  apiKey: string,
  accountNumber: string
): Promise<GasMeterDiscovery> {
  const token = await getValidToken(apiKey);
  const account = accountNumber.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const query = `query {
    account(accountNumber: "${account}") {
      gasAgreements(active: true) {
        meterPoint {
          meters(includeInactive: false) {
            serialNumber
            consumptionUnits
            smartGasMeter { deviceId }
          }
        }
      }
    }
  }`;

  const data = await graphqlRequest<{
    account: {
      gasAgreements: {
        meterPoint: {
          meters: {
            serialNumber: string;
            consumptionUnits: string | null;
            smartGasMeter: { deviceId: string } | null;
          }[];
        };
      }[];
    } | null;
  }>(query, { token, integrationContext: "nexternel-discover-gas" });

  for (const agreement of data.account?.gasAgreements ?? []) {
    for (const meter of agreement.meterPoint?.meters ?? []) {
      const id = meter.smartGasMeter?.deviceId;
      if (id) {
        return {
          deviceId: id,
          consumptionUnits: meter.consumptionUnits?.trim() || null,
        };
      }
    }
  }
  return { deviceId: null, consumptionUnits: null };
}

/** Latest live demand (W) from Home Mini telemetry. */
export async function fetchLiveDemandW(
  apiKey: string,
  deviceId: string
): Promise<{ demandW: number | null; readAt: string | null }> {
  const token = await getValidToken(apiKey);
  const id = deviceId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  // Primary: latest point (official Home Mini pattern — demand often returned as a string).
  const simpleQuery = `query {
    smartMeterTelemetry(deviceId: "${id}") { readAt demand consumption }
  }`;
  const simple = await graphqlRequest<{
    smartMeterTelemetry: { readAt: string; demand: unknown; consumption: unknown }[] | null;
  }>(simpleQuery, { token, integrationContext: "nexternel-live" });

  const simplePoints = simple.smartMeterTelemetry ?? [];
  if (simplePoints.length) {
    const latest = simplePoints[simplePoints.length - 1]!;
    const demandW = parseOctopusNumber(latest.demand);
    if (demandW !== null) {
      return { demandW, readAt: latest.readAt ?? null };
    }
  }

  // Fallback: 10-second grouping window (some accounts need explicit grouping).
  const end = new Date();
  const start = new Date(end.getTime() - 2 * 60 * 1000);
  const windowQuery = `query {
    smartMeterTelemetry(
      deviceId: "${id}"
      grouping: TEN_SECONDS
      start: "${start.toISOString()}"
      end: "${end.toISOString()}"
    ) {
      readAt
      demand
    }
  }`;

  const windowed = await graphqlRequest<{
    smartMeterTelemetry: { readAt: string; demand: unknown }[] | null;
  }>(windowQuery, { token, integrationContext: "nexternel-live-window" });

  const points = windowed.smartMeterTelemetry ?? [];
  if (!points.length) return { demandW: null, readAt: null };

  const latest = points[points.length - 1]!;
  return {
    demandW: parseOctopusNumber(latest.demand),
    readAt: latest.readAt ?? null,
  };
}

/** Sum electricity consumptionDelta (Wh) for today in Europe/London → kWh. */
export async function fetchTodayConsumptionKwh(
  apiKey: string,
  deviceId: string,
  period: { start: string; end: string }
): Promise<{ kwh: number | null; readAt: string | null }> {
  const points = await fetchHalfHourlyTelemetry(apiKey, deviceId, period);
  if (!points.length) return { kwh: null, readAt: null };

  let wh = 0;
  let sawDelta = false;
  let latestReadAt: string | null = null;
  for (const p of points) {
    const delta = parseOctopusNumber(p.consumptionDelta);
    if (delta !== null) {
      wh += delta;
      sawDelta = true;
    }
    if (p.readAt) latestReadAt = p.readAt;
  }
  if (!sawDelta) return { kwh: null, readAt: latestReadAt };
  return { kwh: wh / 1000, readAt: latestReadAt };
}

/**
 * Gas today in kWh — units differ from electricity (m³ vs kWh registers).
 * Prefer cumulative register delta; fall back to consumptionDelta with meter units.
 */
export async function fetchTodayGasConsumptionKwh(
  apiKey: string,
  deviceId: string,
  period: { start: string; end: string },
  consumptionUnits?: string | null
): Promise<{ kwh: number | null; readAt: string | null }> {
  const points = await fetchHalfHourlyTelemetry(apiKey, deviceId, period);
  if (!points.length) return { kwh: null, readAt: null };

  const fromRegister = gasUsageFromRegisterDelta(points);
  if (fromRegister.kwh !== null) {
    return fromRegister;
  }

  let rawSum = 0;
  let sawDelta = false;
  let latestReadAt: string | null = null;
  for (const p of points) {
    const delta = parseOctopusNumber(p.consumptionDelta);
    if (delta !== null) {
      rawSum += delta;
      sawDelta = true;
    }
    if (p.readAt) latestReadAt = p.readAt;
  }
  if (!sawDelta) return { kwh: null, readAt: latestReadAt };

  const kwh = gasDeltaSumToKwh(rawSum, consumptionUnits);
  return { kwh, readAt: latestReadAt };
}

function gasUsageFromRegisterDelta(points: OctopusTelemetryPoint[]): {
  kwh: number | null;
  readAt: string | null;
} {
  if (points.length < 2) return { kwh: null, readAt: null };
  const first = parseOctopusNumber(points[0]!.consumption);
  const last = parseOctopusNumber(points[points.length - 1]!.consumption);
  const readAt = points[points.length - 1]!.readAt ?? null;
  if (first === null || last === null || last < first) {
    return { kwh: null, readAt };
  }
  return { kwh: (last - first) / 1000, readAt };
}

function normalizeGasConsumptionUnits(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

function gasReportsInM3(consumptionUnits: string): boolean {
  return (
    consumptionUnits === "M3" ||
    consumptionUnits.includes("CUBIC") ||
    consumptionUnits.includes("M³")
  );
}

/** Convert summed gas consumptionDelta raw units to kWh. */
export function gasDeltaSumToKwh(rawSum: number, consumptionUnits?: string | null): number {
  const units = normalizeGasConsumptionUnits(consumptionUnits);
  if (gasReportsInM3(units)) {
    const m3 = rawSum / 10000;
    return (m3 * GAS_VOLUME_CORRECTION * GAS_DEFAULT_CALORIFIC_MJ_PER_M3) / 3.6;
  }
  // kWh-register gas (incl. most Home Mini SMETS2): consumptionDelta is Wh, same as electricity.
  return rawSum / 1000;
}

async function fetchHalfHourlyTelemetry(
  apiKey: string,
  deviceId: string,
  period: { start: string; end: string }
): Promise<OctopusTelemetryPoint[]> {
  const token = await getValidToken(apiKey);
  const id = deviceId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const start = period.start.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const end = period.end.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const query = `query {
    smartMeterTelemetry(
      deviceId: "${id}"
      grouping: HALF_HOURLY
      start: "${start}"
      end: "${end}"
    ) {
      readAt
      consumptionDelta
      consumption
      demand
    }
  }`;

  const data = await graphqlRequest<{
    smartMeterTelemetry: OctopusTelemetryPoint[] | null;
  }>(query, { token, integrationContext: "nexternel-daily" });

  return data.smartMeterTelemetry ?? [];
}

export function londonTodayRangeIso(): { start: string; end: string } {
  const end = new Date();
  const londonDate = end.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const offset = londonOffsetIso();
  return {
    start: `${londonDate}T00:00:00${offset}`,
    end: end.toISOString(),
  };
}

function londonOffsetIso(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    timeZoneName: "shortOffset",
  }).formatToParts(new Date());
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  if (tz.includes("+1")) return "+01:00";
  if (tz.includes("-")) {
    const m = /GMT([+-]\d+)/.exec(tz);
    if (m) {
      const h = Number(m[1]);
      const sign = h >= 0 ? "+" : "-";
      return `${sign}${String(Math.abs(h)).padStart(2, "0")}:00`;
    }
  }
  return "+00:00";
}
