import nativeShortcuts from './native-shortcuts.json';
import nativeDownload from './native-download.json';
import { expandedRelease } from './expanded-release';
import audienceRelease from './audience-release.json';
import claudeRelease from './claude-release.json';
import { resolveLanguage } from './core';
import translated from './release-locales.json';

export const releaseEnglish = {
  hide: 'Hide floating controls',
  hideMode: 'When hidden',
  idleOnly: 'Hide idle bubble only',
  allUi: 'Hide bubble and player',
  hideHint: 'Audio keeps working. Restore controls here or with the shortcut.',
  visibilityShortcut: 'Show / hide floating controls',
  unassigned: 'Not assigned',
  customize: 'Customize shortcut',
  shortcutScope: 'Playback keys work on Claude outside text fields.',
  quickStart: 'Start listening',
  quickStartBody: 'Open Claude and start Read Aloud on a completed response. Use the player to pause, seek, change speed, or download.',
  dismiss: 'Got it',
  help: 'Help and troubleshooting',
  pending: 'Starting Read Aloud…',
  nativeHelp: 'Start playback with Claude’s Read Aloud button beside the response.',
  playError: 'Playback could not resume. Start Read Aloud again using Claude’s response button.',
  downloadError: 'Audio could not be downloaded. Start Read Aloud, wait for audio to load, then try again.',
  downloading: 'Preparing your download…',
  savedError: 'The setting could not be saved. Please try again.',
  sourceFormat: nativeDownload.en,
  compactHelp: 'When space is limited, two rounded capsules appear above the message box.',
  surveyTitle: 'Sorry to see you go 💛',
  surveyIntro: 'Thanks for trying Claude Audio Controls. What could we have done better?',
  surveyHint: 'Pick one reason and send. No typing needed.',
  reasonBroken: 'It didn’t work correctly.',
  reasonIntrusive: 'The bubble or player got in the way.',
  reasonSlow: 'It slowed down Claude or my browser.',
  reasonDifficult: 'It was difficult to use.',
  reasonMissing: 'A feature I needed was missing.',
  reasonLanguage: 'My language wasn’t supported well.',
  reasonUnneeded: 'I don’t need it anymore.',
  reasonOther: 'Something else.',
  addNote: 'Add a note — optional',
  noteHint: 'Please don’t include conversations or personal details. Maximum 1,000 characters.',
  send: 'Send feedback',
  feedbackIntro: 'Tell us what could work better. Choose a category and add an optional note.',
  feedbackBug: 'Report a bug',
  feedbackSuggestion: 'Suggest an improvement',
  feedbackThanks: 'Thank you. Your feedback has been saved.',
  sending: 'Sending…',
  skip: 'Skip feedback',
  thanks: 'Thank you for helping us improve. You’re always welcome back.',
  goodbye: 'Thanks for giving us a try. Take care!',
  feedbackError: 'Your feedback wasn’t confirmed. Please try again; your answer is still here.',
  chooseReason: 'Choose one reason to send feedback.',
  feedbackPrivacy: 'Help us make Claude Audio Controls better. Your feedback is optional and private—no name or email needed. Basic app and device details help us understand issues. Please leave out personal details or conversations.',
  appearance: 'Appearance',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  language: 'Language',
  siteTitle: 'Claude Read Aloud, with controls that keep up.',
  siteIntro: 'Pause, rewind, change playback speed and download audio. Stay in the conversation while you listen.',
  chrome: 'Get it for Chrome',
  edge: 'Get it for Edge',
  desktop: 'For desktop Chrome, Edge and compatible browsers. Open this page on your computer to install.',
  features: 'Listen your way',
  setup: 'Three steps to better listening',
  stepInstall: 'Install the extension from your browser’s store.',
  stepRead: 'Open Claude and start Read Aloud on a completed response.',
  stepControl: 'Pause, seek, change speed or save the audio from the player.',
  privacy: 'Privacy',
  privacyBody: 'The extension has no analytics or telemetry. Audio and conversation handling stay in your browser. Browser sync may synchronize preferences.',
  independent: 'An independent open-source project by Infoxica. Not affiliated with or endorsed by Anthropic.',
  analyticsTitle: "Help us make this website more useful",
  analyticsBody: "Help us learn which pages are useful and how people discover the extension. Allow Google Analytics to measure website visits and store-link clicks? The extension and uninstall survey stay free of analytics. You can change your choice anytime.",
  accept: 'Allow analytics',
  decline: 'No thanks',
  preferences: 'Analytics preferences',
  websitePrivacy: 'This website uses Google Analytics only after you allow it. It measures visits and store-link clicks, not installations or extension usage. You can withdraw permission using Analytics preferences.',
  feedbackPolicy: 'Your feedback is optional and private, even after uninstalling. No name or email is required. Please don’t include personal details or conversations.',
  screenshot: 'Claude Read Aloud playback controls',
  available: 'Check your store for the currently available version.',
  website: 'Official website',
};
export type ReleaseCopy = { [K in keyof typeof releaseEnglish]: string };
const expanded = Object.fromEntries(Object.entries(expandedRelease).map(([code, values]) => {
  const keys = Object.keys(releaseEnglish);
  if (values.length !== keys.length || values.some(v => !v.trim())) throw new Error(`Incomplete release locale ${code}: ${values.length}/${keys.length}`);
  return [code, Object.fromEntries(keys.map((key, i) => [key, values[i]])) as ReleaseCopy];
}));
export const releaseLocales: Record<string, ReleaseCopy> = { en: releaseEnglish, ...translated, ...expanded, ...audienceRelease, ...claudeRelease };
for (const [code, copy] of Object.entries(releaseLocales)) {
  copy.sourceFormat = nativeDownload[code as keyof typeof nativeDownload];
  copy.shortcutScope = nativeShortcuts[code as keyof typeof nativeShortcuts];
}
export function getReleaseCopy(language?: string): ReleaseCopy {
  return releaseLocales[resolveLanguage(language)] || releaseEnglish;
}
