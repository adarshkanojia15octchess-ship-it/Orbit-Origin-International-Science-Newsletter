import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  confirmPendingSubscription,
  hashConfirmationToken,
  isValidConfirmationToken,
} from "../lib/subscription/confirmation.mjs";

const token = "a".repeat(64);
const fixedNow = new Date("2026-11-07T08:00:00.000Z");

function makeStore({ status = "pending", expiresAt = "2026-11-08T08:00:00.000Z", tokenHash = hashConfirmationToken(token) } = {}) {
  const subscriber = { status, expiresAt: new Date(expiresAt), tokenHash };
  return {
    subscriber,
    async activatePendingByHash(candidateHash, now) {
      // Mirrors the single conditional UPDATE used by the route: only one
      // request can transition a matching, unexpired pending record.
      if (
        candidateHash !== subscriber.tokenHash ||
        subscriber.status !== "pending" ||
        !subscriber.expiresAt ||
        subscriber.expiresAt.getTime() <= now.getTime()
      ) return false;
      subscriber.status = "active";
      subscriber.tokenHash = null;
      subscriber.expiresAt = null;
      return true;
    },
  };
}

test("accepts only 64-character lowercase hexadecimal tokens", () => {
  assert.equal(isValidConfirmationToken(token), true);
  assert.equal(isValidConfirmationToken("z".repeat(64)), false);
  assert.equal(isValidConfirmationToken("a".repeat(63)), false);
  assert.equal(isValidConfirmationToken(null), false);
});

test("rejects malformed tokens without calling the activation store", async () => {
  let called = false;
  const result = await confirmPendingSubscription({
    token: "not-a-token",
    now: fixedNow,
    activatePendingByHash: async () => { called = true; return true; },
  });
  assert.equal(result, "invalid");
  assert.equal(called, false);
});

test("confirms a matching, unexpired pending subscription", async () => {
  const store = makeStore();
  const result = await confirmPendingSubscription({
    token,
    now: fixedNow,
    activatePendingByHash: store.activatePendingByHash,
  });
  assert.equal(result, "confirmed");
  assert.equal(store.subscriber.status, "active");
  assert.equal(store.subscriber.tokenHash, null);
});

test("rejects expired confirmation tokens", async () => {
  const store = makeStore({ expiresAt: "2026-11-07T07:59:59.999Z" });
  const result = await confirmPendingSubscription({
    token,
    now: fixedNow,
    activatePendingByHash: store.activatePendingByHash,
  });
  assert.equal(result, "invalid");
  assert.equal(store.subscriber.status, "pending");
});

test("rejects unknown tokens and cannot activate another subscriber", async () => {
  const store = makeStore();
  const result = await confirmPendingSubscription({
    token: "b".repeat(64),
    now: fixedNow,
    activatePendingByHash: store.activatePendingByHash,
  });
  assert.equal(result, "invalid");
  assert.equal(store.subscriber.status, "pending");
});

test("rejects replayed confirmation tokens", async () => {
  const store = makeStore();
  const activate = () => confirmPendingSubscription({
    token,
    now: fixedNow,
    activatePendingByHash: store.activatePendingByHash,
  });
  assert.equal(await activate(), "confirmed");
  assert.equal(await activate(), "invalid");
});

test("only one of two duplicate confirmation requests can activate", async () => {
  const store = makeStore();
  const activate = () => confirmPendingSubscription({
    token,
    now: fixedNow,
    activatePendingByHash: store.activatePendingByHash,
  });
  const results = await Promise.all([activate(), activate()]);
  assert.deepEqual(results.sort(), ["confirmed", "invalid"]);
});

test("HTTP route contract keeps GET read-only and activation in POST", async () => {
  const source = await readFile(
    new URL("../app/api/subscribe/confirm/route.ts", import.meta.url),
    "utf8",
  );
  const getBody = source.split("export async function GET")[1]?.split("export async function POST")[0] ?? "";
  const postBody = source.split("export async function POST")[1] ?? "";
  assert.match(source, /export async function GET/);
  assert.match(source, /export async function POST/);
  assert.doesNotMatch(getBody, /createAdminClient|\.update\(/);
  assert.match(postBody, /confirmPendingSubscription/);
  assert.match(postBody, /\.eq\("subscription_status",\s*"pending"\)/);
  assert.match(postBody, /\.gt\("confirmation_expires_at"/);
});

test("subscription rate limiting does not trust arbitrary forwarded headers off Vercel", async () => {
  const source = await readFile(
    new URL("../app/api/subscribe/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /process\.env\.VERCEL === "1"/);
  assert.match(source, /x-vercel-forwarded-for/);
  assert.doesNotMatch(source, /request\.headers\.get\("x-real-ip"\)/);
  assert.doesNotMatch(source, /request\.headers\.get\("x-forwarded-for"\)/);
});
