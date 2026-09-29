/** Shape guards for reviewed JSON, shared by the served readers and the build pipeline. */

export const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isValidDate(value: unknown): value is string {
  if (!isNonEmptyString(value) || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

export function validateUrl(value: unknown, label: string, errors: string[]): void {
  if (!isNonEmptyString(value)) {
    errors.push(`${label}: must be a non-empty URL`);
    return;
  }
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      errors.push(`${label}: only http/https URLs are supported`);
    }
  } catch {
    errors.push(`${label}: invalid URL`);
  }
}

export function validateStringFields(
  record: Record<string, unknown>,
  fields: string[],
  label: string,
  errors: string[],
): void {
  for (const field of fields) {
    if (!isNonEmptyString(record[field])) {
      errors.push(`${label}.${field}: must be a non-empty string`);
    }
  }
}
