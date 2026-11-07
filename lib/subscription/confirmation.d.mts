export type ConfirmationResult = "confirmed" | "invalid";
export function isValidConfirmationToken(token: unknown): token is string;
export function hashConfirmationToken(token: string): string;
export function confirmPendingSubscription(options: {
  token: unknown;
  now?: Date;
  activatePendingByHash: (tokenHash: string, now: Date) => Promise<boolean>;
}): Promise<ConfirmationResult>;
