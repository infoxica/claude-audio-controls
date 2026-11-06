import { ClaudeAudioIcon } from "../../shared/ClaudeAudioIcon";
import { QuickStart } from "../../shared/QuickStart";
import type { ThemePreference } from '../../shared/ThemeSelect';
import { SupportCard } from "../../shared/SupportCard";
import React from "react";
import { ShieldCheck, BookOpen, Bug, Globe, CirclePlay, ArrowUpRight } from "lucide-react";
import { GithubIcon } from "../../shared/GithubIcon";
import { EXTENSION_VERSION } from "../../shared/constants";
import { TranslationSchema } from "../../shared/i18n";
import { websiteURL } from "../../shared/website";
import { getReleaseCopy } from "../../shared/i18n/release-copy";


interface AboutTabProps {
  t: TranslationSchema;
  language: string;
  theme: ThemePreference;
}

export const AboutTab: React.FC<AboutTabProps> = ({ t, language, theme }) => {
  return (
    <div className="popup-body popup-about">
      <div className="section-card about-intro">
        <div className="about-brand">
          <ClaudeAudioIcon size={32} />
          <div className="about-brand-copy">
            <h2>{t.popup.about.title}</h2>
            <p className="about-version">{t.common.version}{EXTENSION_VERSION} · {t.popup.about.byInfoxica}</p>
          </div>
        </div>
        <p className="about-description">{getReleaseCopy(language).siteIntro}</p>
      </div>

      <a className="feature-tour-link" lang="en" href="../tour/index.html" target="_blank" rel="noreferrer">
        <CirclePlay size={18} aria-hidden="true" /><span>Feature tour</span><ArrowUpRight size={16} aria-hidden="true" />
      </a>

      <QuickStart language={language} />

      <SupportCard language={language} theme={theme} surface="popup" />

      <div className="section-card">
        <div className="toggle-row">
          <div className="toggle-info">
            <span className="toggle-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={14} color="var(--accent)" /> {t.popup.about.privacyTitle}
            </span>
            <span className="toggle-desc">{getReleaseCopy(language).privacyBody}</span>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="shortcut-list">

          <a href={websiteURL(language, 'popup')} target="_blank" rel="noreferrer" className="shortcut-row" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="shortcut-name" style={{ display: "flex", alignItems: "center", gap: 6 }}><Globe size={13} /> {getReleaseCopy(language).website}</span>
            <span aria-hidden="true">↗</span>
          </a>
          <a
            href="https://github.com/infoxica/claude-audio-controls"
            target="_blank"
            rel="noreferrer"
            className="shortcut-row"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <span className="shortcut-name" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <GithubIcon size={13} /> {t.popup.about.githubRepo}
            </span>
            <span className="kbd">{t.common.star}</span>
          </a>

          <a
            href="https://github.com/infoxica/claude-audio-controls#readme"
            target="_blank"
            rel="noreferrer"
            className="shortcut-row"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <span className="shortcut-name" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <BookOpen size={13} /> {t.popup.about.documentation}
            </span>
            <span className="kbd">{t.common.docs}</span>
          </a>

          <a
            href="https://github.com/infoxica/claude-audio-controls/issues"
            target="_blank"
            rel="noreferrer"
            className="shortcut-row"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <span className="shortcut-name" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Bug size={13} /> {t.popup.about.reportIssue}
            </span>
            <span className="kbd">{t.common.issues}</span>
          </a>
        </div>
      </div>
    </div>
  );
};
