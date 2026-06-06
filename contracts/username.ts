export const USERNAME_MAX_UNITS = 12;
export const USERNAME_HINT = "最多 8 个中文字符或 12 个英文字符，可使用中文、字母、数字和 .-_";
export const USERNAME_LENGTH_ERROR = "用户名过长：最多 8 个中文字符或 12 个英文字符。";
export const USERNAME_CHAR_ERROR = "用户名只能使用中文、英文字母、数字和 .-_。";

const hanPattern = /^\p{Script=Han}$/u;
const allowedUsernamePattern = /^[\p{Script=Han}A-Za-z0-9._-]+$/u;

export function usernameLengthUnits(name: string) {
  let units = 0;
  for (const char of name) {
    units += hanPattern.test(char) ? 1.5 : 1;
  }
  return units;
}

export function validateUsername(name: string) {
  const value = name.trim();
  if (!value) return "请输入用户名。";
  if (!allowedUsernamePattern.test(value)) return USERNAME_CHAR_ERROR;
  if (usernameLengthUnits(value) > USERNAME_MAX_UNITS) return USERNAME_LENGTH_ERROR;
  return null;
}

export function assertValidUsername(name: string) {
  const error = validateUsername(name);
  if (error) throw new Error(error);
}
