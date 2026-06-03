import "dotenv/config";
import mysql from "mysql2/promise";
import { readFileSync } from "fs";

const SUPER_ADMIN_PUBLIC_ID = 100001;
const FIRST_ADMIN_PUBLIC_ID = 100002;
const MAX_ADMIN_PUBLIC_ID = 100100;
const FIRST_USER_PUBLIC_ID = 100101;
const MAX_USER_PUBLIC_ID = 999999;

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
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const connection = await mysql.createConnection(createConnectionOptions(databaseUrl));
  await connection.beginTransaction();

  try {
    await ensureSequences(connection);

    const [users] = await connection.execute(
      "SELECT id, role, publicId, createdAt FROM users ORDER BY createdAt ASC, id ASC",
    );

    if (users.length === 0) {
      console.log("No users found. Nothing to backfill.");
      await connection.commit();
      await connection.end();
      return;
    }

    const existingSuper = users.find((user) => user.role === "super_admin");
    const firstAdmin = existingSuper || users.find((user) => user.role === "admin");
    let nextAdminPublicId = FIRST_ADMIN_PUBLIC_ID;
    let nextUserPublicId = FIRST_USER_PUBLIC_ID;

    for (const user of users) {
      if (firstAdmin && user.id === firstAdmin.id) {
        await connection.execute(
          "UPDATE users SET publicId = ?, role = 'super_admin', level = 99, emailVerified = TRUE, sessionVersion = COALESCE(sessionVersion, 1) WHERE id = ?",
          [SUPER_ADMIN_PUBLIC_ID, user.id],
        );
        continue;
      }

      if (user.role === "admin" || user.role === "super_admin") {
        if (nextAdminPublicId > MAX_ADMIN_PUBLIC_ID) {
          throw new Error("Admin public ID segment is exhausted.");
        }
        await connection.execute(
          "UPDATE users SET publicId = COALESCE(publicId, ?), role = 'admin', level = 99, sessionVersion = COALESCE(sessionVersion, 1) WHERE id = ?",
          [nextAdminPublicId, user.id],
        );
        nextAdminPublicId += 1;
        continue;
      }

      if (nextUserPublicId > MAX_USER_PUBLIC_ID) {
        throw new Error("User public ID segment is exhausted.");
      }
      await connection.execute(
        "UPDATE users SET publicId = COALESCE(publicId, ?), role = 'user', level = 0, sessionVersion = COALESCE(sessionVersion, 1) WHERE id = ?",
        [nextUserPublicId, user.id],
      );
      nextUserPublicId += 1;
    }

    await connection.execute(
      `UPDATE account_id_sequences
       SET nextValue = CASE
         WHEN name = 'admin_public_id' THEN GREATEST(nextValue, ?)
         WHEN name = 'user_public_id' THEN GREATEST(nextValue, ?)
         ELSE nextValue
       END,
       updatedAt = NOW()
       WHERE name IN ('admin_public_id', 'user_public_id')`,
      [nextAdminPublicId, nextUserPublicId],
    );

    await connection.commit();
    console.log(`Backfilled ${users.length} account(s).`);
  } catch (err) {
    await connection.rollback();
    console.error("Backfill failed:", err.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();
