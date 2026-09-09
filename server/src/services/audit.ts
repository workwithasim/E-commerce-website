import { Request } from 'express';

const sensitiveKey = /password|secret|token|authorization|cookie/i;

export function auditValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const clean = (input: any): any => {
    if (Array.isArray(input)) return input.map(clean);
    if (input && typeof input === 'object') return Object.fromEntries(Object.entries(input).filter(([key]) => !sensitiveKey.test(key)).map(([key, item]) => [key, clean(item)]));
    return input;
  };
  return JSON.stringify(clean(value));
}

export function auditActor(req: Request) {
  return {
    userId: req.user!.id,
    actorRole: req.user!.roles.join(','),
    ip: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}
