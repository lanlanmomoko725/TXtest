export function getAffectedRows(result: unknown): number | undefined {
  const header = Array.isArray(result) ? result[0] : result;
  return header && typeof header === "object" && "affectedRows" in header
    ? Number((header as { affectedRows: unknown }).affectedRows)
    : undefined;
}

export function requireSingleAffectedRow(result: unknown, message: string) {
  if (getAffectedRows(result) !== 1) throw new Error(message);
}
