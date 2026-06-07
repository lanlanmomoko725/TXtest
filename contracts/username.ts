export const USERNAME_MIN_UNITS = 4;
export const USERNAME_MAX_UNITS = 20;
export const USERNAME_PLACEHOLDER = "请输入用户名（4-20个字符）";
export const USERNAME_HINT = "仅支持中英文、数字、下划线、减号";
export const USERNAME_LENGTH_ERROR = "用户名长度需为 4-20 个字符，一个中文字符相当于 2 个字符。";
export const USERNAME_CHAR_ERROR = "用户名仅支持中英文、数字、下划线、减号。";

const hanPattern = /^\p{Script=Han}$/u;
const allowedUsernamePattern = /^[\p{Script=Han}A-Za-z0-9_-]+$/u;

export function usernameLengthUnits(name: string) {
  let units = 0;
  for (const char of name) {
    units += hanPattern.test(char) ? 2 : 1;
  }
  return units;
}

export function validateUsername(name: string) {
  const value = name.trim();
  if (!value) return "请输入用户名。";
  if (!allowedUsernamePattern.test(value)) return USERNAME_CHAR_ERROR;
  const units = usernameLengthUnits(value);
  if (units < USERNAME_MIN_UNITS || units > USERNAME_MAX_UNITS) return USERNAME_LENGTH_ERROR;
  return null;
}

export function assertValidUsername(name: string) {
  const error = validateUsername(name);
  if (error) throw new Error(error);
}
