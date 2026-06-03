import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

export const SUPER_ADMIN_PUBLIC_ID = 100001;
export const FIRST_ADMIN_PUBLIC_ID = 100002;
export const MAX_ADMIN_PUBLIC_ID = 100100;
export const FIRST_USER_PUBLIC_ID = 100101;
export const MAX_USER_PUBLIC_ID = 999999;

type SequenceName = "admin_public_id" | "user_public_id";
type SqlRunner = Pick<ReturnType<typeof getDb>, "execute">;

export async function ensureAccountIdSequences(runner: SqlRunner = getDb()) {
  await runner.execute(sql`
    INSERT IGNORE INTO account_id_sequences (name, nextValue, maxValue, updatedAt)
    VALUES
      ('admin_public_id', ${FIRST_ADMIN_PUBLIC_ID}, ${MAX_ADMIN_PUBLIC_ID}, NOW()),
      ('user_public_id', ${FIRST_USER_PUBLIC_ID}, ${MAX_USER_PUBLIC_ID}, NOW())
  `);
}

export async function allocatePublicId(runner: SqlRunner, sequenceName: SequenceName) {
  await ensureAccountIdSequences(runner);
  const result = await runner.execute(sql`
    UPDATE account_id_sequences
    SET nextValue = LAST_INSERT_ID(nextValue) + 1, updatedAt = NOW()
    WHERE name = ${sequenceName} AND nextValue <= maxValue
  `);

  const affectedRows = Array.isArray(result) && "affectedRows" in result[0]
    ? Number(result[0].affectedRows)
    : 1;
  if (affectedRows === 0) {
    throw new Error(sequenceName === "admin_public_id" ? "管理员 ID 预留段已用完。" : "用户 ID 已用完。");
  }

  const idRows = await runner.execute(sql`SELECT LAST_INSERT_ID() AS value`);
  const value = Array.isArray(idRows) && Array.isArray(idRows[0])
    ? Number((idRows[0] as Array<{ value: number | string }>)[0]?.value)
    : NaN;

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("生成用户 ID 失败，请稍后重试。");
  }
  return value;
}
