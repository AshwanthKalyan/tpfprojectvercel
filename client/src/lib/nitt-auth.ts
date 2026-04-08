export const NITT_EMAIL_REGEX = /^[A-Z0-9._%+-]+@nitt\.edu$/i;
export const NITT_ALERT_KEY = "nittAuthError";
export const NITT_ALERT_MESSAGE = "Use nitt webmail only!";

export function isNittEmail(email: string | null | undefined) {
  return !!email && NITT_EMAIL_REGEX.test(email);
}
