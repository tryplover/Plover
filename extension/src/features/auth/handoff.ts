export const WEBSITE_ORIGINS = {
  prod: ["https://tryplover.com"],
  dev: ["http://localhost:5173"],
} as const;

const TOKEN_HASH = /^[A-Za-z0-9_-]{1,512}$/;

export type ExternalMessage =
  { type: "ping" } | { type: "handoff"; tokenHash: string };

function senderOrigin(sender: {
  origin?: string;
  url?: string;
}): string | null {
  if (sender.origin) return sender.origin;
  if (!sender.url) return null;
  try {
    return new URL(sender.url).origin;
  } catch {
    return null;
  }
}

export function isTrustedWebsiteSender(
  sender: { origin?: string; url?: string },
  dev: boolean,
): boolean {
  const origin = senderOrigin(sender);
  if (origin === null) return false;
  const allowed: readonly string[] = dev
    ? [...WEBSITE_ORIGINS.prod, ...WEBSITE_ORIGINS.dev]
    : WEBSITE_ORIGINS.prod;
  return allowed.includes(origin);
}

export function parseExternalMessage(msg: unknown): ExternalMessage | null {
  if (typeof msg !== "object" || msg === null) return null;
  const { type, tokenHash } = msg as { type?: unknown; tokenHash?: unknown };
  if (type === "plover/ping") return { type: "ping" };
  if (
    type === "plover/handoff" &&
    typeof tokenHash === "string" &&
    TOKEN_HASH.test(tokenHash)
  ) {
    return { type: "handoff", tokenHash };
  }
  return null;
}
