import { expect, test, type Page } from "@playwright/test";

const heading = (page: Page, name: string) =>
  page.getByRole("heading", { level: 2, name, exact: true });

test("opens on Dictation and switches tabs", async ({ page }) => {
  await page.goto("/tests/fixtures/settings.html");
  await expect(page.getByRole("tab", { name: "Dictation" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  for (const name of ["Shortcut", "Microphone", "Language", "Sound"]) {
    await expect(heading(page, name)).toBeVisible();
  }
  await expect(
    page.getByText("Transcribe Shortcut", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Cancel Shortcut", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Translate to English")).toBeVisible();
  await expect(page.getByText("Voice Activity Detection")).toBeVisible();
  await expect(page.getByText("Audio Feedback", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Transcription" }).click();
  for (const name of ["Cleanup", "Pasting", "Submitting"]) {
    await expect(heading(page, name)).toBeVisible();
  }
  await expect(page.getByText("Remove Filler Words")).toBeVisible();
  await expect(page.getByText("Paste Method")).toBeVisible();
  await expect(
    page.getByText("Transcribe Shortcut", { exact: true }),
  ).toBeHidden();

  await page.getByRole("tab", { name: "Appearance" }).click();
  await expect(
    page.getByText("Application Language", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Paste Method")).toBeHidden();

  await page.getByRole("tab", { name: "System" }).click();
  for (const name of ["Startup", "Memory", "Updates", "About"]) {
    await expect(heading(page, name)).toBeVisible();
  }
  await expect(page.getByText("Start Hidden")).toBeVisible();
  await expect(page.getByText("Version", { exact: true })).toBeVisible();
  await expect(
    page.getByText("App Data Directory", { exact: true }),
  ).toBeVisible();
  await expect(heading(page, "Experimental")).toBeVisible();
});

test("shows the Scrub Keyword row in Transcription > Cleanup", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/settings.html");
  await page.getByRole("tab", { name: "Transcription" }).click();
  const cleanup = page.locator("section", {
    has: heading(page, "Cleanup"),
  });
  await expect(
    cleanup.getByText("Scrub Keyword", { exact: true }),
  ).toBeVisible();
  await expect(cleanup.getByRole("textbox")).toHaveValue("scrub that");
});

test("shows the Experimental tab only when experimental is on", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/settings.html");
  await expect(page.getByRole("tab")).toHaveText([
    "Dictation",
    "Transcription",
    "Appearance",
    "System",
  ]);

  // The experimental toggle is the last switch on the System tab
  await page.getByRole("tab", { name: "System" }).click();
  await page
    .locator("label", { has: page.getByRole("checkbox") })
    .last()
    .click();
  await expect(page.getByRole("tab").last()).toHaveText("Experimental");

  await page.getByRole("tab", { name: "Experimental" }).click();
  await expect(heading(page, "Post Processing")).toBeVisible();
  await expect(heading(page, "Advanced")).toBeVisible();
  await expect(
    page.getByText("Keep Mic Open Between Transcriptions"),
  ).toBeVisible();
});

test("falls back to Dictation when the Experimental tab goes away", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/settings.html?experimental=1");
  await page.getByRole("tab", { name: "Experimental" }).click();
  await expect(heading(page, "Advanced")).toBeVisible();

  await page.evaluate(async () => {
    const { useSettingsStore } = await import("/src/stores/settingsStore.ts");
    const { settings } = useSettingsStore.getState();
    useSettingsStore.setState({
      settings: { ...settings!, experimental_enabled: false },
    });
  });
  await expect(page.getByRole("tab", { name: "Experimental" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Dictation" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
