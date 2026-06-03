import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";
import { readFileSync } from "fs";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

type Db = ReturnType<typeof drizzle<typeof fullSchema, Pool>>;

let instance: Db | undefined;
let pool: Pool | undefined;

function createPoolFromEnv() {
  const url = new URL(env.databaseUrl);
  const ssl =
    env.databaseSslCaPath
      ? { ca: readFileSync(env.databaseSslCaPath, "utf8") }
      : env.databaseSsl === "true" || env.databaseSsl === "require"
        ? {}
        : undefined;

  return mysql.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    waitForConnections: true,
    connectionLimit: 10,
    timezone: "Z",
    ssl,
  });
}

export function getDb() {
  if (!instance) {
    pool = createPoolFromEnv();
    instance = drizzle(pool, {
      mode: "default",
      schema: fullSchema,
    });
  }
  return instance;
}
