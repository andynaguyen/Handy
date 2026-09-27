import { expect, test } from "@playwright/test";

const saved = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.styleTest.saved);

const rows = (page: import("@playwright/test").Page) =>
  page.getByRole("list").last().getByRole("listitem");

test("shows each style with its example", async ({ page }) => {
  await page.goto("/tests/fixtures/style.html");
  await expect(page.getByText("No caps + less punctuation")).toBeVisible();
  await expect(
    page.getByText(
      "hey are you free for lunch tomorrow? lets do 12 if that works for you",
      { exact: true },
    ),
  ).toBeVisible();
});

test("lists the default casual apps", async ({ page }) => {
  await page.goto("/tests/fixtures/style.html");
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first()).toContainText("Messages");
  await expect(rows(page).first()).toContainText("Very casual");
});

test("adds a running app that has no rule yet", async ({ page }) => {
  await page.goto("/tests/fixtures/style.html");
  await page.getByRole("button", { name: "Add an open app" }).click();
  await expect(page.getByRole("button", { name: "Mail" })).toBeVisible();
  // Messages already has a rule
  await expect(
    page.getByRole("button", { name: "Messages", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Linear" }).click();

  await expect(rows(page)).toHaveCount(3);
  expect((await saved(page)).at(-1)?.at(-1)).toEqual({
    bundle_id: "com.linear",
    app_name: "Linear",
    style: "casual",
  });
});

test("changes and removes a rule", async ({ page }) => {
  await page.goto("/tests/fixtures/style.html");
  const slack = rows(page).nth(1);
  await slack.getByRole("button", { name: "Very casual" }).click();
  await slack.getByRole("button", { name: "Formal" }).click();
  expect((await saved(page)).at(-1)?.[1].style).toBe("formal");

  await slack.hover();
  await slack.getByRole("button", { name: "Remove Slack" }).click();
  await expect(rows(page)).toHaveCount(1);
  expect((await saved(page)).at(-1)).toHaveLength(1);
});

test("explains that per-app style is macOS only", async ({ page }) => {
  await page.goto("/tests/fixtures/style.html?os=windows");
  await expect(page.getByText("only available on macOS")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add an open app" }),
  ).toHaveCount(0);
});
