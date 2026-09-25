import { expect, test, type Page } from "@playwright/test";

type Backend = "global" | "handy_keys" | "tauri_macos";

async function startRecording(page: Page, backend: Backend) {
  await page.goto(`/tests/fixtures/shortcuts.html?backend=${backend}`);
  await page.getByText("Ctrl + Space", { exact: true }).click();
  await expect(page.getByText("Press keys or a mouse button...")).toBeVisible();
}

async function mouseEvent(
  page: Page,
  backend: Backend,
  type: "mousedown" | "mouseup",
  button: number,
  key: string,
  control = false,
) {
  await page.evaluate(
    async ({ backend, type, button, key, control }) => {
      if (backend !== "global") {
        await window.shortcutTest.emit({
          modifiers: control ? ["ctrl"] : [],
          key,
          is_key_down: type === "mousedown",
          hotkey_string: control ? `ctrl+${key}` : key,
        });
      }
      document.body.dispatchEvent(
        new MouseEvent(type, {
          button,
          ctrlKey: control,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { backend, type, button, key, control },
  );
}

async function expectChanges(page: Page, changes: string[]) {
  await expect
    .poll(() => page.evaluate(() => window.shortcutTest.changes))
    .toEqual(changes);
}

for (const backend of ["global", "handy_keys", "tauri_macos"] as const) {
  test.describe(`${backend} shortcut recorder`, () => {
    for (const [button, key, label] of [
      [1, "mousemiddle", "Middle Mouse"],
      [3, "mousex1", "Mouse 4"],
      [4, "mousex2", "Mouse 5"],
      [7, "mouse8", "Mouse 8"],
    ] as const) {
      test(`records ${label} and commits on release`, async ({ page }) => {
        await startRecording(page, backend);
        await mouseEvent(page, backend, "mousedown", button, key);
        await expect(page.getByText(label, { exact: true })).toBeVisible();
        await expectChanges(page, []);
        await mouseEvent(page, backend, "mouseup", button, key);
        await expectChanges(page, [key]);
        await mouseEvent(page, backend, "mouseup", button, key);
        await expectChanges(page, [key]);
      });
    }

    for (const [button, key, label] of [
      [0, "mouseleft", "Left Mouse"],
      [2, "mouseright", "Right Mouse"],
      [3, "mousex1", "Mouse 4"],
      [7, "mouse8", "Mouse 8"],
    ] as const) {
      test(`records Ctrl plus ${label}`, async ({ page }) => {
        await startRecording(page, backend);
        await mouseEvent(page, backend, "mousedown", button, key, true);
        await expectChanges(page, []);
        await mouseEvent(page, backend, "mouseup", button, key, true);
        await expectChanges(page, [`ctrl+${key}`]);
        await expect(
          page.getByText(`Ctrl + ${label}`, { exact: true }),
        ).toBeVisible();
      });
    }

    test("an ordinary outside click cancels capture", async ({ page }) => {
      await startRecording(page, backend);
      await page.getByRole("button", { name: "Outside recorder" }).click();
      await expect(
        page.getByText("Ctrl + Space", { exact: true }),
      ).toBeVisible();
      await expectChanges(page, backend !== "global" ? ["ctrl+space"] : []);
      await expect
        .poll(() => page.evaluate(() => window.shortcutTest.commands))
        .toContain(
          backend !== "global"
            ? "stop_handy_keys_recording"
            : "resume_all_bindings",
        );
    });

    test("preserves a mouse chord when its modifier is released first", async ({
      page,
    }) => {
      await startRecording(page, backend);
      await page.keyboard.down("Control");
      await mouseEvent(page, backend, "mousedown", 0, "mouseleft", true);
      await page.keyboard.up("Control");
      if (backend !== "global") {
        // Native primary-button events stop arriving without a modifier.
        await page.evaluate(async () => {
          await window.shortcutTest.emit({
            modifiers: [],
            key: null,
            is_key_down: false,
            hotkey_string: "",
          });
        });
      } else {
        await expectChanges(page, []);
        await mouseEvent(page, backend, "mouseup", 0, "mouseleft");
      }
      await expectChanges(page, ["ctrl+mouseleft"]);
      await expect(
        page.getByText("Ctrl + Left Mouse", { exact: true }),
      ).toBeVisible();
    });

    test("still records keyboard chords with modifiers released first", async ({
      page,
    }) => {
      await startRecording(page, backend);
      if (backend === "global") {
        await page.keyboard.down("Control");
        await page.keyboard.down("k");
        await page.keyboard.up("Control");
        await expectChanges(page, []);
        await page.keyboard.up("k");
      } else {
        await page.evaluate(async () => {
          await window.shortcutTest.emit({
            modifiers: ["ctrl"],
            key: "k",
            is_key_down: true,
            hotkey_string: "ctrl+k",
          });
          await window.shortcutTest.emit({
            modifiers: [],
            key: null,
            is_key_down: false,
            hotkey_string: "",
          });
        });
        await expectChanges(page, []);
        await page.evaluate(async () => {
          await window.shortcutTest.emit({
            modifiers: [],
            key: "k",
            is_key_down: false,
            hotkey_string: "k",
          });
        });
      }
      await expectChanges(page, ["ctrl+k"]);
      await expect(page.getByText("Ctrl + K", { exact: true })).toBeVisible();
    });

    test("does not reopen the recorder after a mouse chord on its badge", async ({
      page,
    }) => {
      await startRecording(page, backend);
      const badge = await page
        .getByText("Press keys or a mouse button...")
        .boundingBox();
      expect(badge).not.toBeNull();
      await page.mouse.move(badge!.x + 4, badge!.y + 4);
      await page.keyboard.down("Control");
      await page.mouse.down();
      if (backend !== "global") {
        await mouseEvent(page, backend, "mousedown", 0, "mouseleft", true);
      }
      await page.keyboard.up("Control");
      if (backend !== "global") {
        await page.evaluate(async () => {
          await window.shortcutTest.emit({
            modifiers: [],
            key: null,
            is_key_down: false,
            hotkey_string: "",
          });
        });
      }
      await page.mouse.up();
      await expectChanges(page, ["ctrl+mouseleft"]);
      await expect(
        page.getByText("Ctrl + Left Mouse", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Press keys or a mouse button..."),
      ).toBeHidden();
      const startCommand =
        backend !== "global"
          ? "start_handy_keys_recording"
          : "suspend_all_bindings";
      expect(
        await page.evaluate(
          (command) =>
            window.shortcutTest.commands.filter((value) => value === command)
              .length,
          startCommand,
        ),
      ).toBe(1);
    });
  });
}
