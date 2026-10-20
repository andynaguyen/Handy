//! The update status in the sidebar footer (`update-checker/UpdateChecker.tsx`).
//! Checks once on launch and on demand; installing downloads, verifies and
//! swaps in the new build, then relaunches.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use gpui::{
    div, prelude::*, px, rems, App, Context, Entity, FocusHandle, SharedString, Task, Window,
};

use crate::app_handle::AppEvent;
use crate::i18n::{t, t_with};
use crate::settings;
use crate::ui::components::{
    progress_track, Button, ButtonSize, ButtonVariant, Dialog, KeyboardFocus, RowDirection,
    Typography,
};
use crate::ui::event_bus::event_bus;
use crate::ui::stores::SettingsStore;
use crate::ui::theme::{palette, Alpha};
use crate::updater;

pub struct UpdateChecker {
    settings: Entity<SettingsStore>,
    enabled: bool,
    checking: bool,
    update: Option<updater::Update>,
    show_up_to_date: bool,
    up_to_date_timer: Option<Task<()>>,
    installing: bool,
    progress: u32,
    portable_installer_url: Option<String>,
}

impl UpdateChecker {
    pub fn new(cx: &mut Context<Self>) -> Self {
        let settings = SettingsStore::global(cx);
        cx.observe(&settings, |this, _, cx| this.sync_enabled(cx))
            .detach();
        cx.subscribe(&event_bus(cx), |this, _, event: &AppEvent, cx| {
            if event.name == "check-for-updates" {
                this.check(true, cx);
            }
        })
        .detach();

        let mut this = Self {
            settings,
            enabled: false,
            checking: false,
            update: None,
            show_up_to_date: false,
            up_to_date_timer: None,
            installing: false,
            progress: 0,
            portable_installer_url: None,
        };
        this.sync_enabled(cx);
        this
    }

    fn effectively_enabled(&self, cx: &App) -> bool {
        settings::update_checks_effectively_enabled(&self.settings.read(cx).settings)
    }

    /// Checks when update checks turn on, and clears state when they turn off.
    fn sync_enabled(&mut self, cx: &mut Context<Self>) {
        let enabled = self.effectively_enabled(cx);
        if enabled == self.enabled {
            return;
        }
        self.enabled = enabled;
        if enabled {
            self.check(false, cx);
        } else {
            self.checking = false;
            self.update = None;
            self.show_up_to_date = false;
            self.up_to_date_timer = None;
        }
        cx.notify();
    }

    fn check(&mut self, manual: bool, cx: &mut Context<Self>) {
        if !self.enabled || self.checking {
            return;
        }
        self.checking = true;
        cx.notify();
        cx.spawn(async move |this, cx| {
            let result = crate::runtime::run(updater::check()).await;
            let _ = this.update(cx, |this, cx| {
                this.checking = false;
                match result {
                    Ok(Some(update)) => {
                        this.portable_installer_url =
                            updater::portable_installer_url(&update.raw_json);
                        this.update = Some(update);
                        this.show_up_to_date = false;
                    }
                    Ok(None) => {
                        this.update = None;
                        if manual {
                            this.show_up_to_date = true;
                            this.up_to_date_timer = Some(cx.spawn(async move |this, cx| {
                                cx.background_executor().timer(Duration::from_secs(3)).await;
                                let _ = this.update(cx, |this, cx| {
                                    this.show_up_to_date = false;
                                    cx.notify();
                                });
                            }));
                        }
                    }
                    Err(e) => log::error!("Failed to check for updates: {e}"),
                }
                cx.notify();
            });
        })
        .detach();
    }

    fn install(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        if !self.enabled {
            return;
        }
        if crate::portable::is_portable() {
            self.open_portable_dialog(window, cx);
            return;
        }

        self.installing = true;
        self.progress = 0;
        cx.notify();

        let percent = Arc::new(AtomicU64::new(0));
        cx.spawn(async move |this, cx| {
            let reporter = percent.clone();
            let install = crate::runtime::run(async move {
                // Re-check right before installing, as the Tauri updater did.
                let Some(update) = updater::check().await? else {
                    log::info!("No update available");
                    return Ok(false);
                };
                let downloaded = AtomicU64::new(0);
                updater::download_and_install(&update, |chunk, total| {
                    let done = downloaded.fetch_add(chunk, Ordering::Relaxed) + chunk;
                    if let Some(total) = total.filter(|t| *t > 0) {
                        reporter.store((done * 100 / total).min(100), Ordering::Relaxed);
                    }
                })
                .await?;
                anyhow::Ok(true)
            });

            // Mirror download progress into the view until the task ends.
            let poll = this.clone();
            let progress = percent.clone();
            let ticker = cx.spawn(async move |cx| loop {
                cx.background_executor()
                    .timer(Duration::from_millis(100))
                    .await;
                let value = progress.load(Ordering::Relaxed) as u32;
                if poll
                    .update(cx, |this, cx| {
                        this.progress = value;
                        cx.notify();
                    })
                    .is_err()
                {
                    break;
                }
            });

            let result = install.await;
            drop(ticker);
            match result {
                Ok(true) => {
                    let _ = cx.update(|cx| cx.restart());
                }
                Ok(false) => {}
                Err(e) => log::error!("Failed to install update: {e}"),
            }
            let _ = this.update(cx, |this, cx| {
                this.installing = false;
                this.progress = 0;
                cx.notify();
            });
        })
        .detach();
    }

    fn open_portable_dialog(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let url = self.portable_installer_url.clone();
        let Some(main) = crate::ui::main_view(cx) else {
            return;
        };
        main.update(cx, |main, cx| {
            main.open_dialog(window, cx, move |window, cx| {
                cx.new(|cx| PortableUpdateDialog::new(url, window, cx))
                    .into()
            })
        });
    }

    fn status_text(&self) -> (SharedString, bool) {
        if !self.enabled {
            return (t("footer.updateCheckingDisabled"), false);
        }
        if self.installing {
            return match self.progress {
                1..=99 => (
                    t_with(
                        "footer.downloading",
                        &[("progress", &format!("{:>3}", self.progress))],
                    ),
                    false,
                ),
                100 => (t("footer.installing"), false),
                _ => (t("footer.preparing"), false),
            };
        }
        if self.checking {
            return (t("footer.checkingUpdates"), false);
        }
        if self.show_up_to_date {
            return (t("footer.upToDate"), false);
        }
        if self.update.is_some() {
            return (t("footer.updateAvailableShort"), true);
        }
        (t("footer.checkForUpdates"), true)
    }
}

impl Render for UpdateChecker {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let p = palette(cx);
        let (text, clickable) = self.status_text();
        let available = self.update.is_some() && !self.installing && !self.checking;

        div()
            .flex()
            .row_dir()
            .items_center()
            .gap_3()
            .child(if clickable {
                div()
                    .id("update-status")
                    .cursor_pointer()
                    .when(available, |el| {
                        el.text_color(p.accent)
                            .font_weight(gpui::FontWeight::MEDIUM)
                            .hover(|s| s.text_color(p.accent.a(0.8)))
                    })
                    .when(!available, |el| {
                        el.text_color(p.text.a(0.6))
                            .hover(|s| s.text_color(p.text.a(0.8)))
                    })
                    .keyboard_focus(cx)
                    .on_click(cx.listener(move |this, _, window, cx| {
                        if this.update.is_some() {
                            this.install(window, cx);
                        } else {
                            this.check(true, cx);
                        }
                    }))
                    .child(text)
                    .into_any_element()
            } else {
                div()
                    .text_color(p.text.a(0.6))
                    .child(text)
                    .into_any_element()
            })
            .when(
                self.installing && self.progress > 0 && self.progress < 100,
                |el| el.child(progress_track(self.progress as f32, rems(6.), px(7.5), cx)),
            )
    }
}

/// "Manual update required" for portable installs, which cannot replace
/// themselves. Links to the installer, or to the releases page.
pub struct PortableUpdateDialog {
    url: Option<String>,
    focus: FocusHandle,
}

impl PortableUpdateDialog {
    fn new(url: Option<String>, window: &mut Window, cx: &mut Context<Self>) -> Self {
        let focus = cx.focus_handle();
        focus.focus(window);
        Self { url, focus }
    }
}

impl Render for PortableUpdateDialog {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let p = palette(cx);
        let close = |window: &mut Window, cx: &mut App| crate::ui::shell::close_dialog(window, cx);
        let (message, button) = if self.url.is_some() {
            (
                t("footer.portableUpdateMessage"),
                t("footer.portableUpdateButton"),
            )
        } else {
            (
                t("footer.portableUpdateBrowseMessage"),
                t("footer.portableUpdateBrowseButton"),
            )
        };
        let url = self
            .url
            .clone()
            .unwrap_or_else(|| updater::PORTABLE_RELEASES_URL.to_string());
        Dialog::new(t("footer.portableUpdateTitle"), self.focus.clone(), close)
            .max_width(px(420.))
            .child(div().sm_text().text_color(p.text.a(0.7)).child(message))
            .footer(
                Button::new("portable-close")
                    .variant(ButtonVariant::Secondary)
                    .size(ButtonSize::Md)
                    .child(t("common.close"))
                    .on_click(move |_, window, cx| close(window, cx)),
            )
            .footer(
                Button::new("portable-open")
                    .child(button)
                    .on_click(move |_, window, cx| {
                        cx.open_url(&url);
                        crate::ui::shell::close_dialog(window, cx);
                    }),
            )
    }
}
