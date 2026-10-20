import { test, expect } from "@playwright/test";
test("atomic revision guard isolates namespaces and rejects stale writes", async ({
  page,
}) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { openBookStore } = await import("/src/storage/database.js");
    const { createBook } = await import("/src/storage/book.js");
    const a = await openBookStore("test-a"),
      b = await openBookStore("test-b"),
      book = createBook("personal", "2026-09-01");
    const first = await a.save(book, 0),
      stale = await a.save(book, 0);
    const empty = await b.load();
    a.close();
    b.close();
    return { first: first.ok, stale: stale.ok, empty };
  });
  expect(r).toEqual({ first: true, stale: false, empty: null });
});
