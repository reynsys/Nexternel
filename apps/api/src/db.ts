import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({ connectionString: config.databaseUrl() });
  }
  return pool;
}

export async function checkDatabase(): Promise<"ok" | "error"> {
  try {
    await getPool().query("SELECT 1");
    return "ok";
  } catch {
    return "error";
  }
}

export type DbUser = {
  id: string;
  username: string;
  password_hash: string;
  display_name: string | null;
  is_active: boolean;
  role: string;
  theme_prefs?: unknown;
  avatar_data?: string | null;
};

export type DbRoom = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
};

export type DbDevice = {
  id: string;
  room_id: string | null;
  name: string;
  slug: string;
  mqtt_topic_prefix?: string;
  esphome_name?: string | null;
  is_enabled: boolean;
  is_online: boolean;
  last_seen_at: Date | null;
};
