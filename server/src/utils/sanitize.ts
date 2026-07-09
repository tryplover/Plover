export function sanitizeString(str: unknown): string {
  if (typeof str !== 'string') return '';
  const clean = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return clean.slice(0, 200);
}

export function sanitizePayload(payload: any, depth = 0): any {
  if (depth > 4) return undefined;
  if (typeof payload === 'string') return sanitizeString(payload);
  if (Array.isArray(payload)) {
    return payload
      .map((item) => sanitizePayload(item, depth + 1))
      .filter((v) => v !== undefined);
  }
  if (payload !== null && typeof payload === 'object') {
    const obj: any = {};
    for (const key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        const sanitized = sanitizePayload(payload[key], depth + 1);
        if (sanitized !== undefined) {
          obj[key] = sanitized;
        }
      }
    }
    return obj;
  }
  return payload;
}
