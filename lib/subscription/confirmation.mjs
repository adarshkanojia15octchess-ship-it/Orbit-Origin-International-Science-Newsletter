import { createHash } from "node:crypto";

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function isValidConfirmationToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

export function hashConfirmationToken(token: string): string {
  if (!isValidConfirmationToken(token)) {
    throw new TypeError("Invalid confirmation token");
  }
  return createHash("sha256").update(token).digest("hex");
}

export type ConfirmationResult = "confirmed" | "invalid";

export async function confirmPendingSubscription(options: {
  token: unknown;
  now?: Date;
  activatePendingByHash: (tokenHash: string, now: Date) => Promise<boolean>;
}): Promise<ConfirmationResult> {
  if (!isValidConfirmationToken(options.token)) return "invalid";
  const now = options.now ?? new Date();
  const activated = await options.activatePendingByHash(
    hashConfirmationToken(options.token),
    now,
  );
  return activated ? "confirmed" : "invalid";
}
