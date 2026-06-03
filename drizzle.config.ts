import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { readFileSync } from "fs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

const ssl = process.env.DATABASE_SSL_CA_PATH
  ? { ca: readFileSync(process.env.DATABASE_SSL_CA_PATH, "utf8") }
  : process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "require"
    ? {}
    : undefined;

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
    ssl,
  },
});
