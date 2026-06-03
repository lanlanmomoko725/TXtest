import "dotenv/config";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";

const SUPER_ADMIN_PUBLIC_ID = 100001;
const FIRST_ADMIN_PUBLIC_ID = 100002;
const MAX_ADMIN_PUBLIC_ID = 100100;
const FIRST_USER_PUBLIC_ID = 100101;
const MAX_USER_PUBLIC_ID = 999999;

function validatePassword(password) {
  return password.length >= 8 && /[0-9]/.test(password) && /[a-z]/.test(password) && /[A-Z]/.test(password);
}

function createConnectionOptions(databaseUrl) {
  const url = new URL(databaseUrl);
  const ssl = process.env.DATABASE_SSL_CA_PATH
    ? { ca: readFileSync(process.env.DATABASE_SSL_CA_PATH, "utf8") }
    : process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "require"
      ? {}
      : undefined;

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl,
  };
}

async function ensureSequences(connection) {
  await connection.execute(
    `INSERT IGNORE INTO account_id_sequences (name, nextValue, maxValue, updatedAt)
     VALUES
       ('admin_public_id', ?, ?, NOW()),
       ('user_public_id', ?, ?, NOW())`,
    [FIRST_ADMIN_PUBLIC_ID, MAX_ADMIN_PUBLIC_ID, FIRST_USER_PUBLIC_ID, MAX_USER_PUBLIC_ID],
  );
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set in environment or .env file");
    process.exit(1);
  }

  const connectionOptions = createConnectionOptions(databaseUrl);
  console.log(`Connecting to MySQL at ${connectionOptions.host}:${connectionOptions.port}/${connectionOptions.database} ...`);

  const connection = await mysql.createConnection(connectionOptions);
  console.log("Connected to database");

  await ensureSequences(connection);

  const [superRows] = await connection.execute("SELECT COUNT(*) AS count FROM users WHERE role = 'super_admin'");
  if (Number(superRows[0]?.count ?? 0) > 0) {
    console.log("A super administrator already exists. No changes were made.");
    await connection.end();
    return;
  }

  const readline = (await import("readline")).default;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

  console.log("\nNo super administrator found. Create the first account.\n");

  const email = String(await ask("Email: ")).trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Invalid email address");
    await connection.end();
    process.exit(1);
  }

  const name = String(await ask("Display name: ")).trim() || "Super Admin";

  let password = "";
  while (!validatePassword(password)) {
    password = String(await ask("Password (min 8 chars, upper/lowercase and digit required): "));
    if (!validatePassword(password)) {
      console.log("Password is too weak.");
    }
  }
  rl.close();

  const [publicIdRows] = await connection.execute("SELECT id, email FROM users WHERE publicId = ?", [SUPER_ADMIN_PUBLIC_ID]);
  if (publicIdRows.length > 0 && publicIdRows[0].email !== email) {
    console.error(`publicId ${SUPER_ADMIN_PUBLIC_ID} is already used by another account.`);
    await connection.end();
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const [existing] = await connection.execute("SELECT id FROM users WHERE email = ?", [email]);

  if (existing.length > 0) {
    await connection.execute(
      `UPDATE users
       SET publicId = ?, password = ?, role = 'super_admin', level = 99, name = ?, emailVerified = TRUE,
           sessionVersion = sessionVersion + 1, lockedUntil = NULL, updatedAt = NOW()
       WHERE email = ?`,
      [SUPER_ADMIN_PUBLIC_ID, hashedPassword, name, email],
    );
    console.log(`Upgraded existing user "${email}" to super administrator.`);
  } else {
    await connection.execute(
      `INSERT INTO users (publicId, name, email, password, role, level, emailVerified, sessionVersion, createdAt, updatedAt, lastSignInAt)
       VALUES (?, ?, ?, ?, 'super_admin', 99, TRUE, 1, NOW(), NOW(), NOW())`,
      [SUPER_ADMIN_PUBLIC_ID, name, email, hashedPassword],
    );
    console.log(`Super administrator account created: ${email}`);
  }

  await connection.execute(
    "UPDATE account_id_sequences SET nextValue = GREATEST(nextValue, ?), updatedAt = NOW() WHERE name = 'admin_public_id'",
    [FIRST_ADMIN_PUBLIC_ID],
  );

  await connection.end();
  console.log("\nYou can now log in and add administrator emails via /admin/users.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
