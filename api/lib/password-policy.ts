export {
  LOGIN_PASSWORD_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MAX_UTF8_BYTES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULE_MESSAGE,
  utf8ByteLength,
  validatePasswordPolicy,
} from "@contracts/password";

import { validatePasswordPolicy } from "@contracts/password";

export function assertPasswordPolicy(password: string) {
  const error = validatePasswordPolicy(password);
  if (error) throw new Error(error);
}
