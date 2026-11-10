import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/editorial/asset-url.js", import.meta.url), "utf8");
const moduleUrl = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const { isPublishedStorageAsset } = await import(moduleUrl);
const project = "https://example.supabase.co";

test("accepts a public issue PDF from the configured public bucket", () => {
  assert.equal(isPublishedStorageAsset(project + "/storage/v1/object/public/issue-public/issues/1/published/a/edition.pdf", project), true);
});

test("rejects private draft object paths", () => {
  assert.equal(isPublishedStorageAsset(project + "/storage/v1/object/public/issue-drafts/issues/1/draft.pdf", project), false);
});

test("rejects arbitrary external hosts", () => {
  assert.equal(isPublishedStorageAsset("https://evil.example/storage/v1/object/public/issue-public/edition.pdf", project), false);
});

test("rejects a project URL from another Supabase project", () => {
  assert.equal(isPublishedStorageAsset("https://other.supabase.co/storage/v1/object/public/issue-public/edition.pdf", project), false);
});

test("rejects malformed URLs and traversal paths", () => {
  assert.equal(isPublishedStorageAsset("not a URL", project), false);
  assert.equal(isPublishedStorageAsset(project + "/storage/v1/object/public/issue-public/issues/../secret.pdf", project), false);
});
