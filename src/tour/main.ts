import './tour.css';
import { getLucideSvg } from '../content/icons';

const steps = [
  { title: 'Start with Claude’s voice', description: 'Open a conversation and choose Read aloud beneath a completed Claude reply. Audio Controls works with Claude’s own voice.', icons: ['volume-2'], label: 'Read aloud' },
  { title: 'Listen at your own pace', description: 'Pause and resume without losing your place. Jump back or forward, or drag the progress bar to revisit audio that has already arrived.', icons: ['rotate-ccw', 'play', 'rotate-cw'], label: '0:24 ━━━━━●━━━━ 1:30' },
  { title: 'Find your listening rhythm', description: 'Choose a speed from 0.5× to 3×. Hover over or tap the volume control to adjust the sound, or mute it when you need a quiet moment.', icons: ['play', 'volume-2'], label: '0.5×   1×   1.5×   2×   3×' },
  { title: 'Keep the audio you need', description: 'Once the full reply is ready, use Download to save it. The file stays on your device; no conversation or audio is sent to Infoxica.', icons: ['download'], label: 'Full audio ready' },
  { title: 'Make room for your conversation', description: 'Keep the player above the composer, drag it to another position, or choose a layout in settings. Collapse it when you need more space. The help menu lists your shortcuts.', icons: ['grip-vertical', 'minimize-2', 'circle-help'], label: 'Your player, your layout' },
];
const button = (id: string) => document.getElementById(id) as HTMLButtonElement;
const next = button('next');
const back = button('back');
let index = 0;
let finishing = false;
function render() {
  const step = steps[index];
  document.getElementById('title')!.textContent = step.title;
  document.getElementById('description')!.textContent = step.description;
  document.getElementById('progress')!.textContent = `${index + 1} of ${steps.length}`;
  document.getElementById('preview')!.innerHTML = `<div class="demo-controls">${step.icons.map(icon => getLucideSvg(icon)).join('')}</div><span>${step.label}</span>`;
  document.getElementById('dots')!.innerHTML = steps.map((_, i) => `<span class="${i === index ? 'active' : ''}"></span>`).join('');
  back.disabled = index === 0;
  next.textContent = index === steps.length - 1 ? 'Open Claude' : 'Next';
}
async function finish(skipped: boolean) {
  if (finishing) return;
  finishing = true;
  try {
    await chrome.storage.local.set({ 'claude-ra-tour-v1': skipped ? 'skipped' : 'completed' });
    // Reuse the welcome tab instead of opening another tab.
    location.assign('https://claude.ai/new');
  } catch {
    finishing = false;
    document.getElementById('description')!.textContent = 'Your browser could not save this choice. Please try again.';
  }
}
next.onclick = () => { if (index < steps.length - 1) { index++; render(); } else void finish(false); };
back.onclick = () => { if (index > 0) { index--; render(); } };
button('skip').onclick = () => void finish(true);
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'Escape') { event.preventDefault(); void finish(true); }
  if (event.key === 'ArrowRight' && index < steps.length - 1) { event.preventDefault(); index++; render(); }
  if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); index--; render(); }
});
render();
