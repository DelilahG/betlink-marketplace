/**
 * Ethiopian phone numbers. Accepts +251 911 234 567, 251911234567, 0911234567, 911234567,
 * Safaricom 07 numbers and Addis/regional landlines (011, 022, ...). Normalizes to E.164: +251XXXXXXXXX.
 */
const LANDLINE_AREA = ['11', '22', '25', '33', '34', '46', '47', '57', '58'];

export function normalizeEthiopianPhone(input: string): string | null {
  let digits = input.trim().replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith('251')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 9) return null;
  const isMobile = /^[79]\d{8}$/.test(digits);
  const isLandline = LANDLINE_AREA.includes(digits.slice(0, 2));
  return isMobile || isLandline ? `+251${digits}` : null;
}

export function isEthiopianMobile(e164: string) {
  return /^\+251[79]\d{8}$/.test(e164);
}
