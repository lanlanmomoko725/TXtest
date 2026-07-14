export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;
export const PASSWORD_MAX_UTF8_BYTES = 72;
export const LOGIN_PASSWORD_MAX_LENGTH = 1024;
export const PASSWORD_RULE_MESSAGE =
  "密码需为 8-64 个字符、UTF-8 不超过 72 bytes，并包含数字、大写字母和小写字母。";

export function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

export function validatePasswordPolicy(password: string): string | null {
  const characterLength = Array.from(password).length;
  if (characterLength < PASSWORD_MIN_LENGTH || characterLength > PASSWORD_MAX_LENGTH) {
    return PASSWORD_RULE_MESSAGE;
  }
  if (utf8ByteLength(password) > PASSWORD_MAX_UTF8_BYTES) return PASSWORD_RULE_MESSAGE;
  if (!/[0-9]/.test(password)) return PASSWORD_RULE_MESSAGE;
  if (!/[a-z]/.test(password)) return PASSWORD_RULE_MESSAGE;
  if (!/[A-Z]/.test(password)) return PASSWORD_RULE_MESSAGE;
  return null;
}
