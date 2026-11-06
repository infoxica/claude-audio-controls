import { LayoutSettings, DownloadNotificationSettings } from '../../shared/LayoutSettings';
import { VisibilitySettings } from "../../shared/VisibilitySettings";
import React from "react";
import { platformKeys } from '../../shared/shortcuts';
import { Gauge, Volume2, FastForward, Globe, Check } from "lucide-react";
import { SPEED_PRESETS, SUPPORTED_LANGUAGES } from "../../shared/constants";
import { ExtensionSettings, SupportedLanguage } from "../../shared/types";
import { TranslationSchema, detectBrowserLanguage } from "../../shared/i18n";

interface GeneralSettingsProps {
  settings: ExtensionSettings;
  onUpdateSettings: (newSettings: Partial<ExtensionSettings>) => void;
  t: TranslationSchema;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  settings,
  onUpdateSettings,
  t,
}) => {
  const detectedCode = detectBrowserLanguage();
  const detectedLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === detectedCode);
  const currentLang = settings.language || "auto";

  return (
    <div className="settings-section general-settings">
      {/* Playback Speed Preferences */}
      <div className="card">
        <div className="card-title">
          <Gauge size={16} color="var(--accent)" />
          <span>{t.options.general.speedTitle}</span>
        </div>
        <p className="card-desc">
          {t.options.general.speedDesc}
        </p>

        <select className="preference-select" aria-label={t.options.general.speedTitle} value={settings.defaultSpeed} onChange={e => onUpdateSettings({ defaultSpeed: Number(e.target.value) })}>
          {SPEED_PRESETS.map(speed => <option key={speed} value={speed}>{speed}×</option>)}
        </select>
      </div>

      {/* Default Volume Level */}
      <div className="card">
        <div className="card-title">
          <Volume2 size={16} color="var(--accent)" />
          <span>{t.options.general.volumeTitle}</span>
        </div>
        <p className="card-desc">
          {t.options.general.volumeDesc}
        </p>

        <div className="preference-volume">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.defaultVolume}
            onChange={(e) => onUpdateSettings({ defaultVolume: parseFloat(e.target.value) })}
            aria-label={t.options.general.volumeTitle}
            className="custom-range"
            style={{ flex: 1, maxWidth: 360 }}
          />
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, minWidth: 44 }}>
            {Math.round(settings.defaultVolume * 100)}%
          </span>
        </div>
      </div>

      {/* Skip & Seek Step */}
      <div className="card">
        <div className="card-title">
          <FastForward size={16} color="var(--accent)" />
          <span>{t.options.general.seekTitle}</span>
        </div>
        <p className="card-desc">
          {platformKeys(t.options.general.seekDesc)}
        </p>

        <select className="preference-select" aria-label={t.options.general.seekTitle} value={settings.tapSeekSeconds} onChange={e => onUpdateSettings({ tapSeekSeconds: Number(e.target.value) })}>
          {[5, 10, 15, 30].map(seconds => <option key={seconds} value={seconds}>{seconds} {t.options.general.secondsUnit}</option>)}
        </select>
      </div>
      {/* Language & Localization */}
      <div className="card">
        <div className="card-title">
          <Globe size={16} color="var(--accent)" />
          <span>{t.options.general.languageTitle}</span>
        </div>
        <p className="card-desc">
          {t.options.general.languageDesc}
        </p>

        <div id="options-language" className="language-grid" role="group" aria-label={t.options.general.languageTitle}>
          {SUPPORTED_LANGUAGES.map(lang => {
            const selected = currentLang === lang.code;
            return <button key={lang.code} type="button" aria-pressed={selected} className="language-choice" onClick={() => onUpdateSettings({ language: lang.code as SupportedLanguage })}>
              <span><span className="language-native">{lang.nativeName}</span><span className="language-hint">{lang.code === 'auto' && detectedLangObj ? `${t.options.general.languageDetected}: ${detectedLangObj.nativeName}` : lang.label}</span></span>
              {selected && <Check size={16} aria-hidden="true" />}
            </button>;
          })}
        </div>
      </div>

      <VisibilitySettings surface="dashboard" settings={settings} onUpdateSettings={onUpdateSettings} />
      <DownloadNotificationSettings surface="dashboard" settings={settings} onUpdateSettings={onUpdateSettings} />
      <LayoutSettings surface="dashboard" language={settings.language} />
    </div>
  );
};
