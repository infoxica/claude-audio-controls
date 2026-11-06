import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './release-ui.css';
import { getReleaseCopy } from './i18n/release-copy';

export function QuickStart({ language }: { language: string }) {
  const [dismissed, setDismissed] = useState(true);
  const copy = getReleaseCopy(language);
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) void chrome.storage.local.get('quickStartDismissed').then(result => setDismissed(result.quickStartDismissed === true));
    else setDismissed(localStorage.getItem('quickStartDismissed') === 'true');
  }, []);
  const dismiss = () => {
    setDismissed(true);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) void chrome.storage.local.set({ quickStartDismissed: true });
    else localStorage.setItem('quickStartDismissed', 'true');
  };
  if (dismissed) return null;
  return <aside className="release-ui quick-start">
    <details><summary><span>{copy.quickStart}</span><ChevronDown size={16} aria-hidden="true" /></summary><p>{copy.quickStartBody}</p><button className="btn-outline" onClick={dismiss}>{copy.dismiss}</button></details>
  </aside>;
}
