import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { validateLibraryFile } from "./validate-library.mjs";

const validItem = {
  jobId: "J1784256147282",
  type: "interactive",
  subject: "Thai",
  grade: "P3",
  topic: "Reading",
  url: "https://example.com/games/J1784256147282.html",
  date: "2026-07-17",
};

async function withLibrary(items, fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "teacher-media-library-"));
  const file = path.join(dir, "library.json");
  await writeFile(file, JSON.stringify(items, null, 2), "utf8");

  try {
    return await fn(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("accepts a valid library item", async () => {
  await withLibrary([validItem], async (file) => {
    const result = await validateLibraryFile(file);
    assert.deepEqual(result.errors, []);
  });
});

test("requires every MediaItem field", async () => {
  const incompleteItem = { ...validItem };
  delete incompleteItem.topic;

  await withLibrary([incompleteItem], async (file) => {
    const result = await validateLibraryFile(file);
    assert.match(result.errors.join("\n"), /item 1: missing required field "topic"/);
  });
});

test("requires date in YYYY-MM-DD format", async () => {
  await withLibrary([{ ...validItem, date: "17/07/2026" }], async (file) => {
    const result = await validateLibraryFile(file);
    assert.match(result.errors.join("\n"), /item 1: date must use YYYY-MM-DD/);
  });
});

test("rejects a url that is not a valid URI", async () => {
  await withLibrary([{ ...validItem, url: "games/J1784256147282.html" }], async (file) => {
    const result = await validateLibraryFile(file);
    assert.match(result.errors.join("\n"), /item 1: url must be a valid URL/);
  });
});

test("rejects a field the schema does not declare", async () => {
  await withLibrary([{ ...validItem, madeUpField: "ไม่มีใน schema" }], async (file) => {
    const result = await validateLibraryFile(file);
    assert.match(result.errors.join("\n"), /item 1: unknown field "madeUpField"/);
  });
});

test("rejects duplicate jobId and url values across the file", async () => {
  await withLibrary(
    [
      validItem,
      {
        ...validItem,
        topic: "Different topic",
      },
    ],
    async (file) => {
      const result = await validateLibraryFile(file);
      assert.match(result.errors.join("\n"), /duplicate jobId "J1784256147282"/);
      assert.match(result.errors.join("\n"), /duplicate url "https:\/\/example\.com\/games\/J1784256147282\.html"/);
    },
  );
});
