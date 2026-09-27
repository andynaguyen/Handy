import { expect, test } from "@playwright/test";

test("opens on App and switches tabs", async ({ page }) => {
  await page.goto("/tests/fixtures/advanced.html");
  await expect(page.getByRole("tab", { name: "App" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("Start Hidden")).toBeVisible();

  await page.getByRole("tab", { name: "Output" }).click();
  await expect(page.getByText("Paste Method")).toBeVisible();
  await expect(page.getByText("Start Hidden")).toBeHidden();

  await page.getByRole("tab", { name: "Transcription" }).click();
  await expect(page.getByText("Voice Activity Detection")).toBeVisible();

  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText("History Limit")).toBeVisible();
});

test("shows the Experimental tab only when experimental is on", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/advanced.html");
  await expect(page.getByRole("tab")).toHaveText([
    "App",
    "Output",
    "Transcription",
    "History",
  ]);

  // The experimental toggle is the last switch on the App tab
  await page
    .locator("label", { has: page.getByRole("checkbox") })
    .last()
    .click();
  await page.getByRole("tab", { name: "Experimental" }).click();
  await expect(
    page.getByText("Keep Mic Open Between Transcriptions"),
  ).toBeVisible();
});
