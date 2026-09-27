import { expect, test } from "@playwright/test";

test("opens on Keybinding and switches tabs", async ({ page }) => {
  await page.goto("/tests/fixtures/settings.html");
  await expect(page.getByRole("tab", { name: "Keybinding" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByText("Transcribe Shortcut", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Shortcut Behavior", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Cancel Shortcut", { exact: true }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Sound" }).click();
  await expect(page.getByText("Microphone", { exact: true })).toBeVisible();
  await expect(page.getByText("Audio Feedback", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Transcribe Shortcut", { exact: true }),
  ).toBeHidden();

  await page.getByRole("tab", { name: "App" }).click();
  await expect(page.getByText("Start Hidden")).toBeVisible();

  await page.getByRole("tab", { name: "Output" }).click();
  await expect(page.getByText("Paste Method")).toBeVisible();
  await expect(page.getByText("Start Hidden")).toBeHidden();

  await page.getByRole("tab", { name: "Transcription" }).click();
  await expect(page.getByText("Language", { exact: true })).toBeVisible();
  await expect(page.getByText("Translate to English")).toBeVisible();
  await expect(page.getByText("Voice Activity Detection")).toBeVisible();

  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText("History Limit")).toBeVisible();
});

test("shows the Experimental tab only when experimental is on", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/settings.html");
  await expect(page.getByRole("tab")).toHaveText([
    "Keybinding",
    "Sound",
    "App",
    "Output",
    "Transcription",
    "History",
    "About",
  ]);

  // The experimental toggle is the last switch on the App tab
  await page.getByRole("tab", { name: "App" }).click();
  await page
    .locator("label", { has: page.getByRole("checkbox") })
    .last()
    .click();
  await expect(page.getByRole("tab").last()).toHaveText("About");
  await page.getByRole("tab", { name: "Experimental" }).click();
  await expect(
    page.getByText("Keep Mic Open Between Transcriptions"),
  ).toBeVisible();
});

test("shows About as the last tab", async ({ page }) => {
  await page.goto("/tests/fixtures/settings.html?experimental=1");
  await expect(page.getByRole("tab").last()).toHaveText("About");

  await page.getByRole("tab", { name: "About" }).click();
  await expect(
    page.getByText("Application Language", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Version", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Support Development", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Source Code", { exact: true })).toBeVisible();
  await expect(
    page.getByText("App Data Directory", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Start Hidden")).toBeHidden();
});
