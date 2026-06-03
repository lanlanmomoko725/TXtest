export const PASSWORD_RULE_MESSAGE = "密码至少 8 位，并且必须包含数字、大写字母和小写字母。";

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 8) return PASSWORD_RULE_MESSAGE;
  if (!/[0-9]/.test(password)) return PASSWORD_RULE_MESSAGE;
  if (!/[a-z]/.test(password)) return PASSWORD_RULE_MESSAGE;
  if (!/[A-Z]/.test(password)) return PASSWORD_RULE_MESSAGE;
  return null;
}

export function assertPasswordPolicy(password: string) {
  const error = validatePasswordPolicy(password);
  if (error) throw new Error(error);
}
