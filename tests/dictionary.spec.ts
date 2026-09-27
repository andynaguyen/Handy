import { expect, test } from "@playwright/test";

const saved = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.customizeTest.saved);

test("shows the Dictionary, Snippets, and Style tabs in order", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/customize.html");
  await expect(page.getByRole("tab")).toHaveText([
    "Dictionary",
    "Snippets",
    "Style",
  ]);
  await expect(page.getByRole("tab", { name: "Dictionary" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("shows an empty state with no words", async ({ page }) => {
  await page.goto("/tests/fixtures/customize.html");
  await expect(page.getByText("No words yet.", { exact: false })).toBeVisible();
});

test("lists words newest first", async ({ page }) => {
  await page.goto("/tests/fixtures/customize.html?words=Karat,Wispr Flow,QA");
  await expect(page.getByRole("listitem")).toHaveText([
    "QA",
    "Wispr Flow",
    "Karat",
  ]);
});

test("adds a normalized word from the dialog", async ({ page }) => {
  await page.goto("/tests/fixtures/customize.html?words=Karat");
  await page.getByRole("button", { name: "Add new" }).click();
  const input = page.getByPlaceholder("Add a word");
  await expect(input).toBeFocused();
  await input.fill('  "idempotency"   key ');
  await input.press("Enter");

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("listitem").first()).toHaveText(
    "idempotency key",
  );
  expect(await saved(page)).toEqual([["Karat", "idempotency key"]]);
});

test("blocks duplicates", async ({ page }) => {
  await page.goto("/tests/fixtures/customize.html?words=Karat");
  await page.getByRole("button", { name: "Add new" }).click();
  await page.getByPlaceholder("Add a word").fill("Karat");

  await expect(page.getByText('"Karat" already exists')).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add", exact: true }),
  ).toBeDisabled();
});

test("cancel discards the draft", async ({ page }) => {
  await page.goto("/tests/fixtures/customize.html");
  await page.getByRole("button", { name: "Add new" }).click();
  await page.getByPlaceholder("Add a word").fill("draft");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Add new" }).click();
  await expect(page.getByPlaceholder("Add a word")).toHaveValue("");
  expect(await saved(page)).toEqual([]);
});

test("filters by search, case-insensitively", async ({ page }) => {
  await page.goto(
    "/tests/fixtures/customize.html?words=Karat,Andy,Andy Nguyen",
  );
  await page.getByPlaceholder("Search").fill("andy");
  await expect(page.getByRole("listitem")).toHaveText(["Andy Nguyen", "Andy"]);

  await page.getByPlaceholder("Search").fill("zzz");
  await expect(page.getByText('No words match "zzz"')).toBeVisible();
});

test("removes a word", async ({ page }) => {
  await page.goto("/tests/fixtures/customize.html?words=Karat,QA");
  await page.getByRole("button", { name: "Remove Karat" }).click();

  await expect(page.getByRole("listitem")).toHaveText(["QA"]);
  expect(await saved(page)).toEqual([["QA"]]);
});

const snippetsPage = (snippets: { trigger: string; text: string }[] = []) =>
  `/tests/fixtures/customize.html?snippets=${encodeURIComponent(JSON.stringify(snippets))}`;

const openSnippetsTab = async (page: import("@playwright/test").Page) => {
  await page.getByRole("tab", { name: "Snippets" }).click();
};

const savedSnippets = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.customizeTest.savedSnippets);

test("adds a snippet from the snippets tab", async ({ page }) => {
  await page.goto(snippetsPage());
  await openSnippetsTab(page);
  await expect(
    page.getByText("No snippets yet.", { exact: false }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add new" }).click();
  const trigger = page.getByPlaceholder('Trigger phrase, like "my email"');
  await expect(trigger).toBeFocused();
  await trigger.fill("  my   email ");
  await page.getByPlaceholder("Text to paste").fill("andy@example.com");
  await expect(page.getByText("16/4000")).toBeVisible();
  await page.getByRole("button", { name: "Add snippet" }).click();

  await expect(page.getByRole("listitem")).toHaveText([
    "my email→andy@example.com",
  ]);
  expect(await savedSnippets(page)).toEqual([
    [{ trigger: "my email", text: "andy@example.com" }],
  ]);
});

test("blocks triggers that would match the same speech", async ({ page }) => {
  await page.goto(snippetsPage([{ trigger: "my email", text: "a@b.c" }]));
  await openSnippetsTab(page);
  await page.getByRole("button", { name: "Add new" }).click();
  await page
    .getByPlaceholder('Trigger phrase, like "my email"')
    .fill("My, Email!");
  await page.getByPlaceholder("Text to paste").fill("other");

  await expect(
    page.getByText('A snippet for "My, Email!" already exists'),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add snippet" }),
  ).toBeDisabled();
});

test("edits a snippet in place", async ({ page }) => {
  await page.goto(
    snippetsPage([
      { trigger: "my email", text: "old@example.com" },
      { trigger: "sign off", text: "Thanks" },
    ]),
  );
  await openSnippetsTab(page);
  await page.getByRole("button", { name: "my email old@example.com" }).click();
  await expect(page.getByRole("dialog")).toContainText("Edit snippet");
  await page.getByPlaceholder("Text to paste").fill("new@example.com");
  await page.getByRole("button", { name: "Save" }).click();

  expect(await savedSnippets(page)).toEqual([
    [
      { trigger: "my email", text: "new@example.com" },
      { trigger: "sign off", text: "Thanks" },
    ],
  ]);
});

test("searches snippet triggers and text, and removes one", async ({
  page,
}) => {
  await page.goto(
    snippetsPage([
      { trigger: "my email", text: "andy@example.com" },
      { trigger: "sign off", text: "Thanks, Andy" },
      { trigger: "intro", text: "Hi there" },
    ]),
  );
  await openSnippetsTab(page);
  await page.getByPlaceholder("Search").fill("andy");
  await expect(page.getByRole("listitem")).toHaveCount(2);

  await page.getByRole("button", { name: "Remove sign off" }).click();
  expect(await savedSnippets(page)).toEqual([
    [
      { trigger: "my email", text: "andy@example.com" },
      { trigger: "intro", text: "Hi there" },
    ],
  ]);
});
