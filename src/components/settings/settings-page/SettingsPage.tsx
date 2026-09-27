import React, { useState } from "react";
import { type } from "@tauri-apps/plugin-os";
import { ShowOverlay } from "../ShowOverlay";
import { ModelUnloadTimeoutSetting } from "../ModelUnloadTimeout";
import { SettingsGroup } from "../../ui/SettingsGroup";
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
import { HistoryLimit } from "../HistoryLimit";
import { RecordingRetentionPeriodSelector } from "../RecordingRetentionPeriod";
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
import { ModelLanguageSettings } from "./ModelLanguageSettings";

const TABS = [
  { id: "keybinding", labelKey: "settings.advanced.groups.keybinding" },
  { id: "sound", labelKey: "settings.sound.title" },
  { id: "app", labelKey: "settings.advanced.groups.app" },
  { id: "output", labelKey: "settings.advanced.groups.output" },
  { id: "transcription", labelKey: "settings.advanced.groups.transcription" },
  { id: "history", labelKey: "settings.advanced.groups.history" },
  { id: "experimental", labelKey: "settings.advanced.groups.experimental" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export const SettingsPage: React.FC = () => {
  const { getSetting, audioFeedbackEnabled } = useSettings();
  const isLinux = type() === "linux";
  const experimentalEnabled = getSetting("experimental_enabled") || false;
  const postProcessEnabled = getSetting("post_process_enabled") || false;
  const [selectedTab, setSelectedTab] = useState<TabId>("keybinding");
  const tabs = experimentalEnabled
    ? TABS
    : TABS.filter((tab) => tab.id !== "experimental");
  // Fall back to App if the Experimental tab disappears while selected.
  const activeTab =
    selectedTab === "experimental" && !experimentalEnabled
      ? "app"
      : selectedTab;

  return (
    <div className="max-w-3xl w-full mx-auto space-y-5">
      <Tabs tabs={tabs} selected={activeTab} onSelect={setSelectedTab} />

      {activeTab === "keybinding" && (
        <SettingsGroup>
          <ShortcutInput shortcutId="transcribe" grouped={true} />
          <ShortcutActivationSetting descriptionMode="inline" grouped={true} />
          {/* Cancel shortcut remains hidden on Linux because of dynamic shortcut instability. */}
          {!isLinux && <ShortcutInput shortcutId="cancel" grouped={true} />}
        </SettingsGroup>
      )}

      {activeTab === "sound" && (
        <SettingsGroup>
          <MicrophoneSelector descriptionMode="inline" grouped={true} />
          <ChannelSelector descriptionMode="inline" grouped={true} />
          <MuteWhileRecording descriptionMode="inline" grouped={true} />
          <AudioFeedback descriptionMode="inline" grouped={true} />
          <OutputDeviceSelector
            descriptionMode="inline"
            grouped={true}
            disabled={!audioFeedbackEnabled}
          />
          <VolumeSlider disabled={!audioFeedbackEnabled} />
        </SettingsGroup>
      )}

      {activeTab === "app" && (
        <SettingsGroup>
          <StartHidden descriptionMode="inline" grouped={true} />
          <AutostartToggle descriptionMode="inline" grouped={true} />
          <ShowTrayIcon descriptionMode="inline" grouped={true} />
          <ShowOverlay descriptionMode="inline" grouped={true} />
          <ModelUnloadTimeoutSetting descriptionMode="inline" grouped={true} />
          <ExperimentalToggle descriptionMode="inline" grouped={true} />
        </SettingsGroup>
      )}

      {activeTab === "output" && (
        <SettingsGroup>
          <PasteMethodSetting descriptionMode="inline" grouped={true} />
          <TypingToolSetting descriptionMode="inline" grouped={true} />
          <ClipboardHandlingSetting descriptionMode="inline" grouped={true} />
          <AutoSubmit descriptionMode="inline" grouped={true} />
          <VoiceSubmit grouped={true} />
        </SettingsGroup>
      )}

      {activeTab === "transcription" && (
        <SettingsGroup>
          <ModelLanguageSettings />
          <VoiceActivityDetection descriptionMode="inline" grouped={true} />
          <FillerWordRemoval descriptionMode="inline" grouped={true} />
          <AppendTrailingSpace descriptionMode="inline" grouped={true} />
        </SettingsGroup>
      )}

      {activeTab === "history" && (
        <SettingsGroup>
          <HistoryLimit descriptionMode="inline" grouped={true} />
          <RecordingRetentionPeriodSelector
            descriptionMode="inline"
            grouped={true}
          />
        </SettingsGroup>
      )}

      {activeTab === "experimental" && (
        <SettingsGroup>
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
          <KeyboardImplementationSelector
            descriptionMode="inline"
            grouped={true}
          />
          <AccelerationSelector descriptionMode="inline" grouped={true} />
          <LazyStreamClose descriptionMode="inline" grouped={true} />
          <VadBackendSelector descriptionMode="inline" grouped={true} />
        </SettingsGroup>
      )}
    </div>
  );
};
