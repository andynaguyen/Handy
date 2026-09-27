import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { type } from "@tauri-apps/plugin-os";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ShowOverlay } from "../ShowOverlay";
import { ModelUnloadTimeoutSetting } from "../ModelUnloadTimeout";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { SettingContainer } from "../../ui/SettingContainer";
import { Button } from "../../ui/Button";
import { Tabs } from "../../ui/Tabs";
import { StartHidden } from "../StartHidden";
import { AutostartToggle } from "../AutostartToggle";
import { ShowTrayIcon } from "../ShowTrayIcon";
import { PasteMethodSetting } from "../PasteMethod";
import { TypingToolSetting } from "../TypingTool";
import { ClipboardHandlingSetting } from "../ClipboardHandling";
import { AutoSubmit } from "../AutoSubmit";
import { VoiceSubmit } from "../VoiceSubmit";
import { PostProcessingToggle } from "../PostProcessingToggle";
import { PostProcessingSettingsApi } from "../PostProcessingSettingsApi";
import { PostProcessingSettingsPrompts } from "../PostProcessingSettingsPrompts";
import { ShortcutInput } from "../ShortcutInput";
import { AppendTrailingSpace } from "../AppendTrailingSpace";
import { ExperimentalToggle } from "../ExperimentalToggle";
import { useSettings } from "../../../hooks/useSettings";
import { KeyboardImplementationSelector } from "../debug/KeyboardImplementationSelector";
import { VoiceActivityDetection } from "../VoiceActivityDetection";
import { AccelerationSelector } from "../AccelerationSelector";
import { LazyStreamClose } from "../LazyStreamClose";
import { FillerWordRemoval } from "../FillerWordRemoval";
import { VadBackendSelector } from "../VadBackendSelector";
import { ShortcutActivationSetting } from "../ShortcutActivation";
import { MicrophoneSelector } from "../MicrophoneSelector";
import { ChannelSelector } from "../ChannelSelector";
import { MuteWhileRecording } from "../MuteWhileRecording";
import { AudioFeedback } from "../AudioFeedback";
import { OutputDeviceSelector } from "../OutputDeviceSelector";
import { VolumeSlider } from "../VolumeSlider";
import { AppDataDirectory } from "../AppDataDirectory";
import { AppLanguageSelector } from "../AppLanguageSelector";
import { ShowWhatsNewOnUpdate } from "../ShowWhatsNewOnUpdate";
import { ThemeSelector } from "../ThemeSelector";
import { LogDirectory } from "../debug";
import { ModelLanguageSettings } from "./ModelLanguageSettings";

const TABS = [
  { id: "dictation", labelKey: "settings.advanced.groups.dictation" },
  { id: "transcription", labelKey: "settings.advanced.groups.transcription" },
  { id: "appearance", labelKey: "settings.advanced.groups.appearance" },
  { id: "system", labelKey: "settings.advanced.groups.system" },
  { id: "experimental", labelKey: "settings.advanced.groups.experimental" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const AboutGroup: React.FC = () => {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const appVersion = await getVersion();
        setVersion(appVersion);
      } catch (error) {
        console.error("Failed to get app version:", error);
        setVersion("0.1.2");
      }
    };

    fetchVersion();
  }, []);

  const handleDonateClick = async () => {
    try {
      await openUrl("https://handy.computer/donate");
    } catch (error) {
      console.error("Failed to open donate link:", error);
    }
  };

  return (
    <SettingsGroup title={t("settings.about.title")}>
      <SettingContainer
        title={t("settings.about.version.title")}
        description={t("settings.about.version.description")}
        grouped={true}
      >
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <span className="text-sm font-mono">v{version}</span>
      </SettingContainer>

      <SettingContainer
        title={t("settings.about.supportDevelopment.title")}
        description={t("settings.about.supportDevelopment.description")}
        grouped={true}
      >
        <Button variant="primary" size="md" onClick={handleDonateClick}>
          {t("settings.about.supportDevelopment.button")}
        </Button>
      </SettingContainer>

      <SettingContainer
        title={t("settings.about.sourceCode.title")}
        description={t("settings.about.sourceCode.description")}
        grouped={true}
      >
        <Button
          variant="secondary"
          size="md"
          onClick={() => openUrl("https://github.com/cjpais/Handy")}
        >
          {t("settings.about.sourceCode.button")}
        </Button>
      </SettingContainer>

      <AppDataDirectory descriptionMode="inline" grouped={true} />
      <LogDirectory grouped={true} />
    </SettingsGroup>
  );
};

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting, audioFeedbackEnabled } = useSettings();
  const isLinux = type() === "linux";
  const experimentalEnabled = getSetting("experimental_enabled") || false;
  const postProcessEnabled = getSetting("post_process_enabled") || false;
  const [selectedTab, setSelectedTab] = useState<TabId>("dictation");
  const tabs = experimentalEnabled
    ? TABS
    : TABS.filter((tab) => tab.id !== "experimental");
  // Fall back to Dictation if the Experimental tab disappears while selected.
  const activeTab =
    selectedTab === "experimental" && !experimentalEnabled
      ? "dictation"
      : selectedTab;

  return (
    <div className="max-w-3xl w-full mx-auto space-y-5">
      <Tabs tabs={tabs} selected={activeTab} onSelect={setSelectedTab} />

      {activeTab === "dictation" && (
        <>
          <SettingsGroup title={t("settings.advanced.groups.shortcut")}>
            <ShortcutInput shortcutId="transcribe" grouped={true} />
            <ShortcutActivationSetting
              descriptionMode="inline"
              grouped={true}
            />
            {/* Cancel shortcut remains hidden on Linux because of dynamic shortcut instability. */}
            {!isLinux && <ShortcutInput shortcutId="cancel" grouped={true} />}
          </SettingsGroup>
          <SettingsGroup title={t("settings.sound.microphone.title")}>
            <MicrophoneSelector descriptionMode="inline" grouped={true} />
            <ChannelSelector descriptionMode="inline" grouped={true} />
            <MuteWhileRecording descriptionMode="inline" grouped={true} />
          </SettingsGroup>
          <SettingsGroup title={t("settings.general.language.title")}>
            <ModelLanguageSettings />
            <VoiceActivityDetection descriptionMode="inline" grouped={true} />
          </SettingsGroup>
          <SettingsGroup title={t("settings.sound.title")}>
            <AudioFeedback descriptionMode="inline" grouped={true} />
            <OutputDeviceSelector
              descriptionMode="inline"
              grouped={true}
              disabled={!audioFeedbackEnabled}
            />
            <VolumeSlider disabled={!audioFeedbackEnabled} />
          </SettingsGroup>
        </>
      )}

      {activeTab === "transcription" && (
        <>
          <SettingsGroup title={t("settings.advanced.groups.cleanup")}>
            <FillerWordRemoval descriptionMode="inline" grouped={true} />
            <AppendTrailingSpace descriptionMode="inline" grouped={true} />
          </SettingsGroup>
          <SettingsGroup title={t("settings.advanced.groups.pasting")}>
            <PasteMethodSetting descriptionMode="inline" grouped={true} />
            <TypingToolSetting descriptionMode="inline" grouped={true} />
            <ClipboardHandlingSetting descriptionMode="inline" grouped={true} />
          </SettingsGroup>
          <SettingsGroup title={t("settings.advanced.groups.submitting")}>
            <AutoSubmit descriptionMode="inline" grouped={true} />
            <VoiceSubmit grouped={true} />
          </SettingsGroup>
        </>
      )}

      {activeTab === "appearance" && (
        <SettingsGroup>
          <AppLanguageSelector descriptionMode="inline" grouped={true} />
          <ThemeSelector descriptionMode="inline" grouped={true} />
          <ShowOverlay descriptionMode="inline" grouped={true} />
        </SettingsGroup>
      )}

      {activeTab === "system" && (
        <>
          <SettingsGroup title={t("settings.advanced.groups.startup")}>
            <StartHidden descriptionMode="inline" grouped={true} />
            <AutostartToggle descriptionMode="inline" grouped={true} />
            <ShowTrayIcon descriptionMode="inline" grouped={true} />
          </SettingsGroup>
          <SettingsGroup title={t("settings.advanced.groups.memory")}>
            <ModelUnloadTimeoutSetting
              descriptionMode="inline"
              grouped={true}
            />
          </SettingsGroup>
          <SettingsGroup title={t("settings.advanced.groups.updates")}>
            <ShowWhatsNewOnUpdate descriptionMode="inline" grouped={true} />
          </SettingsGroup>
          <AboutGroup />
          <SettingsGroup title={t("settings.advanced.groups.experimental")}>
            <ExperimentalToggle descriptionMode="inline" grouped={true} />
          </SettingsGroup>
        </>
      )}

      {activeTab === "experimental" && (
        <>
          <SettingsGroup title={t("settings.debug.postProcessingToggle.label")}>
            <PostProcessingToggle descriptionMode="inline" grouped={true} />
            {postProcessEnabled && (
              <>
                <ShortcutInput
                  shortcutId="transcribe_with_post_process"
                  descriptionMode="inline"
                  grouped={true}
                />
                <PostProcessingSettingsApi />
                <PostProcessingSettingsPrompts />
              </>
            )}
          </SettingsGroup>
          <SettingsGroup title={t("settings.advanced.groups.advanced")}>
            <KeyboardImplementationSelector
              descriptionMode="inline"
              grouped={true}
            />
            <AccelerationSelector descriptionMode="inline" grouped={true} />
            <LazyStreamClose descriptionMode="inline" grouped={true} />
            <VadBackendSelector descriptionMode="inline" grouped={true} />
          </SettingsGroup>
        </>
      )}
    </div>
  );
};
