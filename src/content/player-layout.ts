import { PRESETS, defaultLayout, defaultProfile, isLayout, migrateLayout, LayoutPreferences, LayoutProfile, layoutProfile, LAYOUT_KEY } from '../shared/layout';
import { featureCopy } from '../shared/i18n/features';
import { languageDirection, getTranslations } from '../shared/i18n/core';
import { dockGeometry, intersects, fits, distanceToRect, magneticOffset, PlayerGeometry, Rect } from './layout-geometry';
import { getLucideSvg, setIcon } from './icons';

declare const __USERSCRIPT__: boolean;
declare const __PLAYER_CSS__: string;
const standalone = typeof __USERSCRIPT__ !== 'undefined' && __USERSCRIPT__;
const source = 'claude-audio-controls-settings-bridge';
const bounds = (el: HTMLElement): Rect => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
// Collapsed app navigation can keep its full layout width inside a transparent
// or clipped ancestor. Only its painted portion should reserve player space.
function visibleBounds(el: HTMLElement): Rect | null {
  const r = bounds(el);
  if (r.width <= 0 || r.height <= 0 || getComputedStyle(el).visibility !== 'visible') return null;
  let left = r.x, top = r.y, right = r.x + r.width, bottom = r.y + r.height;
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (node.hidden || node.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.opacity === '0' || style.contentVisibility === 'hidden') return null;
    if (node === el || style.display === 'contents') continue;
    const clipX = /^(hidden|clip|scroll|auto)$/.test(style.overflowX);
    const clipY = /^(hidden|clip|scroll|auto)$/.test(style.overflowY);
    if (clipX || clipY) {
      const clip = node.getBoundingClientRect();
      if (clipX) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
      if (clipY) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
    }
  }
  return right > left && bottom > top ? { x: left, y: top, width: right - left, height: bottom - top } : null;
}
export class PlayerLayout {
  private observedChrome: HTMLElement[] = [];
  private chromeResize = new ResizeObserver(() => this.changed());
  private chromeAttributes = new MutationObserver(() => this.changed());
  private preferences = defaultLayout();
  private expanded = false;
  private composer: HTMLElement | null = null;
  private surface = document.createElement('div');
  private join = document.createElement('div');
  private layer = document.createElement('div');
  private overlay: HTMLElement | null = null;
  private cancelDrag: (() => void) | null = null;
  private dragging = false;
  private motion = 220;
  private previous = '';
  private lastExpanded = false;
  private extras = document.createElement('div');
  private more = document.createElement('button');
  private pending = new Map<string, { resolve: () => void; reject: () => void; timer: ReturnType<typeof setTimeout> }>();
  constructor(private seek: HTMLElement, private controls: HTMLElement, private circle: HTMLButtonElement, private changed: () => void, private failed: () => void, private language: () => string | undefined) {
    this.surface.id = 'claude-ra-dock'; this.surface.setAttribute('aria-hidden', 'true'); this.layer.id = 'claude-ra-layer'; document.body.append(this.layer); this.layer.append(this.surface, seek, controls, circle);
    this.join.className = 'claude-ra-dock-join'; this.join.setAttribute('aria-hidden', 'true'); this.join.hidden = true; this.layer.prepend(this.join);
    if (standalone) { try { this.preferences = migrateLayout(JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null')); } catch {} }
    window.addEventListener('message', event => {
      if (event.source !== window || event.data?.source !== source) return;
      if (event.data.type === 'CLAUDE_RA_LAYOUT_UPDATE' && isLayout(event.data.layout)) {
        this.cancelDrag?.();
        const next = event.data.layout;
        if (JSON.stringify(next) === JSON.stringify(defaultLayout())) this.motion = 280;
        this.preferences = next; this.changed();
      }
      if (event.data.type === 'CLAUDE_RA_LAYOUT_SAVED') {
        const job = this.pending.get(event.data.id); if (!job) return;
        clearTimeout(job.timer); this.pending.delete(event.data.id); event.data.ok ? job.resolve() : job.reject();
      }
    });
    window.addEventListener('storage', event => {
      if (!standalone || event.key !== LAYOUT_KEY) return;
      this.cancelDrag?.();
      try { this.preferences = migrateLayout(JSON.parse(event.newValue || 'null')); this.changed(); } catch {}
    });
    document.addEventListener('transitionend', event => { if (event.target instanceof HTMLElement && this.observedChrome.includes(event.target)) this.changed(); }, true);
    this.installDrag(circle);
    for (const pill of [seek, controls]) {
      const grip = document.createElement('button'); grip.type = 'button'; grip.className = 'claude-ra-grip';
      grip.innerHTML = getLucideSvg('grip-vertical');
      pill.prepend(grip); this.installDrag(grip, pill);
    }
    this.extras.className = 'claude-ra-extras';
    this.extras.id = 'claude-ra-extras';
    for (const el of controls.querySelectorAll(':scope > .claude-ra-speed-wrap, :scope > .claude-ra-volume-wrap, :scope > .claude-ra-download-wrap, :scope > .claude-ra-help-wrap')) this.extras.append(el);
    this.more.type = 'button'; this.more.className = 'claude-ra-icon-btn claude-ra-more';
    this.more.innerHTML = getLucideSvg('ellipsis');
    this.more.setAttribute('aria-controls', this.extras.id); this.more.setAttribute('aria-expanded', 'false');
    this.more.onclick = () => {
      const open = this.extras.classList.toggle('claude-open');
      this.more.setAttribute('aria-expanded', String(open));
      if (!open) this.extras.querySelectorAll('.claude-open').forEach(el => el.classList.remove('claude-open'));
      this.positionPopovers();
    };
    controls.addEventListener('keydown', event => {
      const popover = this.extras.querySelector<HTMLElement>('.claude-open');
      if (event.key === 'Escape' && (this.extras.classList.contains('claude-open') || popover)) {
        event.preventDefault();
        const trigger = this.more.getClientRects().length ? this.more : popover?.querySelector<HTMLButtonElement>('button');
        this.extras.classList.remove('claude-open');
        this.extras.querySelectorAll('.claude-open').forEach(el => el.classList.remove('claude-open'));
        this.more.setAttribute('aria-expanded', 'false'); trigger?.focus();
      }
    });
    controls.append(this.more, this.extras);
    window.postMessage({ source, type: 'CLAUDE_RA_LAYOUT_REQUEST' }, '*');
  }
  async reset(): Promise<void> { this.cancelDrag?.(); this.motion = 280; await this.save(defaultLayout()); }
  private async save(value: LayoutPreferences): Promise<void> {
    try {
      if (standalone) localStorage.setItem(LAYOUT_KEY, JSON.stringify(value));
      else await new Promise<void>((resolve, reject) => {
        const id = crypto.randomUUID();
        const timer = setTimeout(() => { this.pending.delete(id); reject(); }, 4000);
        this.pending.set(id, { resolve, reject, timer });
        window.postMessage({ source, type: 'CLAUDE_RA_LAYOUT_SAVE', id, layout: value }, '*');
      });
      this.preferences = value;
    } catch { this.failed(); }
    this.changed();
  }
  private viewport(): Rect {
    const v = window.visualViewport, safe = getComputedStyle(this.circle);
    const inset = (side: string) => Math.max(12, parseFloat(safe.getPropertyValue('--claude-safe-' + side)) || 0);
    const left = inset('left'), right = inset('right'), top = inset('top'), bottom = inset('bottom');
    return { x: (v?.offsetLeft || 0) + left, y: (v?.offsetTop || 0) + top, width: Math.max(44, (v?.width || innerWidth) - left - right), height: Math.max(44, (v?.height || innerHeight) - top - bottom) };
  }
  private obstacles(): Rect[] {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('header, [role="banner"], [data-testid="chat-header"], .dframe-header, [role="toolbar"][aria-label="Page tools"], nav, aside, [role="complementary"], [aria-label="Sidebar"], [data-cds="Sidebar"], [data-testid="sidebar"], [data-testid="artifact-panel"], [data-testid="artifacts-panel"], [data-testid="page-header"], [data-testid="app-shell-sidebar"], #app-shell-sidebar'))
      .filter(e => !e.closest('[id^="claude-ra"], article, [data-message-author-role], [data-testid^="conversation-turn"], [data-writing-block]'));
    // Sidebar overlays can resize or collapse without changing the composer.
    // Observe their clipping ancestors too, but never the player's own styles.
    const watched = new Set<HTMLElement>();
    for (const element of elements) for (let node: HTMLElement | null = element; node; node = node.parentElement) watched.add(node);
    const nodes = [...watched];
    if (nodes.length !== this.observedChrome.length || nodes.some((node, i) => node !== this.observedChrome[i])) {
      this.chromeResize.disconnect(); this.chromeAttributes.disconnect(); this.observedChrome = nodes;
      for (const node of nodes) {
        this.chromeResize.observe(node);
        this.chromeAttributes.observe(node, { attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-state'] });
      }
    }
    return elements.map(visibleBounds)
      .filter((r): r is Rect => !!r && r.width <= innerWidth && (r.height < innerHeight * .7 || r.width < innerWidth * .9));
  }
  private availableArea(viewport: Rect, obstacles: Rect[]): Rect {
    const area = { ...viewport };
    for (const o of obstacles) {
      if (o.height > viewport.height * .6) {
        if (o.x <= viewport.x && o.x + o.width > area.x) {
          const right = area.x + area.width; area.x = o.x + o.width + 8; area.width = Math.max(0, right - area.x);
        } else if (o.x + o.width >= viewport.x + viewport.width) {
          area.width = Math.max(0, Math.min(area.x + area.width, o.x - 8) - area.x);
        }
      } else if (o.width > viewport.width * .45 && o.y < viewport.y + 90 && o.y + o.height < viewport.y + viewport.height / 2) {
        const bottom = area.y + area.height; area.y = Math.max(area.y, o.y + o.height + 8); area.height = Math.max(0, bottom - area.y);
      }
    }
    return area;
  }
  private nativeActions(): Rect[] {
    // Only application chrome outside conversations/composers; response toolbars
    // and email editors must never force the player away from its saved dock.
    return Array.from(document.querySelectorAll<HTMLElement>('[data-testid="chat-header"] :is(button, a, [role="checkbox"]), .dframe-header :is(button, a, [role="checkbox"]), [role="toolbar"][aria-label="Page tools"] :is(button, a, [role="checkbox"]), header button, [role="banner"] button, [data-testid="page-header"] button, [data-testid="conversation-header"] button, #conversation-header-actions button, [data-testid="share-chat-button"], [data-testid="conversation-options-button"]'))
      .filter(e => !e.closest('[id^="claude-ra"], article, [data-message-author-role], [data-testid^="conversation-turn"], [data-writing-block], form, [contenteditable]'))
      .map(visibleBounds).filter((r): r is Rect => !!r);
  }
  private geometry(p: LayoutProfile, expanded: boolean): PlayerGeometry | null {
    const viewport = this.viewport(), obstacles = this.obstacles(), area = this.availableArea(viewport, obstacles);
    const c = this.composer ? bounds(this.composer) : undefined;
    const native = this.composer && getComputedStyle(this.composer);
    const radius = (value: string | undefined) => value?.endsWith('%') ? (parseFloat(value) || 0) * (c?.width || 0) / 100 : parseFloat(value || '') || 0;
    const environment = { actions: this.nativeActions(), cornerLeft: radius(native?.borderTopLeftRadius), cornerRight: radius(native?.borderTopRightRadius) };
    let result = dockGeometry(p, area, expanded, c, languageDirection(this.language()) === 'rtl', layoutProfile(innerWidth) === 'narrow', environment);
    // A corner that intersects the composer can move upward, keeping its shape.
    if (c && expanded && p.preset.startsWith('bottom') && (!result || [result.seek, result.controls, result.circle].some(r => intersects(r, c)))) {
      result = dockGeometry(p, { ...area, height: c.y - area.y - 8 }, expanded, c, false, false, environment);
    }
    if (!result) return null;
    const parts = expanded ? [result.seek, result.controls, result.circle] : [result.circle];
    if (parts.some(r => !fits(r, viewport) || obstacles.some(o => intersects(r, o)) || c && intersects(r, c))) return null;
    return result;
  }
  private compactGeometry(profile: LayoutProfile, expanded: boolean): PlayerGeometry | null {
    const obstacles = this.obstacles(), v = this.availableArea(this.viewport(), obstacles), c = this.composer && bounds(this.composer);
    // A temporary floating surface keeps an absent/off-screen composer from
    // turning the expand button into a dead end. It is never persisted.
    const bottoms = [c ? c.y - 8 : v.y + v.height, v.y + v.height, v.y + 100];
    for (const bottom of bottoms) {
      const g = dockGeometry({ ...profile, preset: 'composer' }, v, expanded, { x: v.x, y: bottom, width: v.width, height: 0 }, languageDirection(this.language()) === 'rtl', true);
      if (!g) continue;
      const parts = expanded ? [g.surface!, g.circle] : [g.circle];
      if (parts.every(r => !obstacles.some(o => intersects(r, o)) && (!c || !intersects(r, c)))) return { ...g, attachedToComposer: false };
    }
    return null;
  }
  sync(composer: HTMLElement | null, expanded: boolean): void {
    this.composer = composer; this.expanded = expanded;
    // Claude can replace body children during hydration or navigation. Keep the
    // existing controls (and their listeners/session) instead of rebuilding UI.
    if (!this.layer.isConnected && document.body) {
      this.cancelDrag?.();
      document.body.append(this.layer);
      this.previous = '';
    }
    if (this.dragging) return;
    const key = layoutProfile(innerWidth), profile = this.preferences[key];
    const geometry = this.geometry(profile, expanded) || this.compactGeometry(profile, expanded);
    const composerStyle = composer && getComputedStyle(composer);
    const nativeShadow = composerStyle?.boxShadow;
    const corners = composerStyle ? [composerStyle.borderTopLeftRadius, composerStyle.borderTopRightRadius] : undefined;
    for (const element of [this.seek, this.controls, this.circle]) element.style.setProperty('--claude-ra-composer-radius', corners?.[0] || '14px');
    const signature = JSON.stringify([geometry, expanded, this.language(), composerStyle?.backgroundColor, composerStyle?.borderLeftColor, nativeShadow, corners]);
    if (this.previous === signature) {
      this.surface.hidden = !geometry?.surface || this.circle.classList.contains('claude-ra-hidden');
      this.join.hidden = this.surface.hidden || !expanded || !geometry?.attachedToComposer;
      this.positionPopovers(); return;
    }
    const elements = [this.seek, this.controls, this.circle, this.surface, this.join];
    const before = elements.map(bounds);
    for (const el of elements) { el.getAnimations().forEach(a => a.cancel()); el.style.transform = ''; }
    if (!geometry) {
      this.previous = ''; // Repaint when an overlay closes and the same geometry fits again.
      this.seek.classList.add('claude-ra-fit-hidden'); this.controls.classList.add('claude-ra-fit-hidden'); this.surface.hidden = true;
      this.join.hidden = true;
      const obstacles = this.obstacles(), v = this.availableArea(this.viewport(), obstacles);
      const candidates = [
        this.geometry({ preset: 'composer', seekFirst: true }, false)?.circle,
        { x: v.x + v.width - 44, y: v.y, width: 44, height: 44 },
        { x: v.x, y: v.y, width: 44, height: 44 },
        { x: v.x, y: v.y + v.height - 44, width: 44, height: 44 },
      ].filter((r): r is Rect => !!r);
      const target = candidates.find(r => fits(r, v) && !obstacles.some(o => intersects(r, o)) && (!composer || !intersects(r, bounds(composer))));
      this.circle.classList.toggle('claude-ra-fit-hidden', !target);
      if (target) this.place(this.circle, target);
      this.circle.classList.remove('claude-ra-dock-toggle'); this.circle.classList.add('claude-ra-logo'); setIcon(this.circle, 'claude-audio'); return;
    }
    this.circle.classList.remove('claude-ra-fit-hidden');
    const firstAppearance = !this.previous;
    const changed = this.previous !== signature, animate = !!this.previous && changed && !this.reducedMotion();
    const duration = expanded !== this.lastExpanded ? 200 : this.motion;
    this.previous = signature; this.motion = 220;
    const docked = !!geometry.surface;
    for (const el of [this.seek, this.controls]) {
      el.classList.remove('claude-ra-fit-hidden');
      el.classList.toggle('claude-ra-in-dock', docked);
      el.inert = !expanded;
    }
    this.seek.classList.toggle('claude-ra-vertical', geometry.verticalSeek);
    this.controls.classList.toggle('claude-ra-vertical', geometry.verticalControls);
    this.controls.classList.toggle('claude-ra-compact-controls', !!geometry.compactControls);
    this.more.title = getTranslations(this.language()).popup.tabs.controls;
    this.more.setAttribute('aria-label', this.more.title);
    this.circle.dataset.preset = profile.preset;
    this.circle.classList.toggle('claude-ra-dock-toggle', docked);
    this.circle.classList.toggle('claude-ra-logo', !expanded);
    setIcon(this.circle, expanded ? (docked ? 'chevron-down' : 'minimize-2') : 'claude-audio');
    if (geometry.circleVisual) {
      this.circle.style.setProperty('--toggle-top', (geometry.circleVisual.y - geometry.circle.y) + 'px');
    }
    this.place(this.seek, geometry.seek); this.place(this.controls, geometry.controls); this.place(this.circle, geometry.circle);
    this.surface.hidden = !docked || this.circle.classList.contains('claude-ra-hidden');
    this.join.hidden = this.surface.hidden || !expanded || !geometry.attachedToComposer;
    if (geometry.surface) {
      this.place(this.surface, geometry.surface);
      const style = composerStyle;
      this.surface.style.background = style && style.backgroundColor !== 'rgba(0, 0, 0, 0)' ? style.backgroundColor : getComputedStyle(this.controls).getPropertyValue('--claude-ra-bg');
      if (geometry.attachedToComposer) this.paintJoin(this.join, geometry.surface, this.surface.style.background);
      this.surface.style.borderColor = style?.borderLeftColor || '';
      this.surface.style.borderWidth = style?.borderLeftWidth || '';
      this.surface.style.borderStyle = style?.borderLeftStyle || '';
      this.surface.style.borderBottomWidth = geometry.attachedToComposer ? '0' : (style?.borderLeftWidth || '');
      // Copy the complete native ring/shadow rather than fabricating a 1px ring.
      this.surface.style.boxShadow = nativeShadow || 'none';
      this.surface.style.clipPath = geometry.attachedToComposer ? 'inset(-8px -8px 0)' : 'none';
      this.circle.style.setProperty('--dock-border', style?.borderLeftColor || 'var(--claude-ra-border)');
      this.circle.style.setProperty('--dock-border-width', style?.borderLeftWidth || '1px');
      this.circle.style.setProperty('--dock-border-style', style?.borderLeftStyle || 'solid');
      this.circle.style.setProperty('--dock-shadow', nativeShadow || 'none');
      this.circle.style.setProperty('--dock-background', this.surface.style.background);
      this.surface.style.borderTopLeftRadius = corners?.[0] || '14px';
      this.surface.style.borderTopRightRadius = corners?.[1] || '14px';
      this.surface.style.borderBottomLeftRadius = this.surface.style.borderBottomRightRadius = geometry.attachedToComposer ? '0' : '14px';
    }
    this.surface.classList.toggle('claude-ra-dock-closed', !expanded);
    if (animate) {
      elements.forEach((el, i) => {
        const after = bounds(el), old = before[i];
        if (el.hidden || !after.width || !old.width) return;
        let from = { transform: 'translate(' + (old.x - after.x) + 'px,' + (old.y - after.y) + 'px) scale(' + old.width / after.width + ',' + old.height / after.height + ')', transformOrigin: '0 0' };
        if (expanded !== this.lastExpanded && el !== this.circle) {
          el.animate(expanded
            ? [{ transform: 'scale(0)', opacity: 0, transformOrigin: 'center' }, { transform: 'scale(1)', opacity: 1, transformOrigin: 'center' }]
            : [{ transform: 'scale(1)', opacity: 1, transformOrigin: 'center', visibility: 'visible' }, { transform: 'scale(0)', opacity: 0, transformOrigin: 'center', visibility: 'visible' }],
            { duration, easing: 'cubic-bezier(.2,.8,.2,1)' });
        } else {
          el.animate([from, { transform: 'translate(0,0) scale(1)', transformOrigin: '0 0' }], { duration, easing: 'cubic-bezier(.16,1,.3,1)' });
        }
      });
    }
    if ((firstAppearance || expanded !== this.lastExpanded) && !this.reducedMotion()) {
      this.circle.getAnimations().forEach(animation => animation.cancel());
      this.circle.animate([{ transform: 'scale(0)', opacity: 0, transformOrigin: 'center' }, { transform: 'scale(1)', opacity: 1, transformOrigin: 'center' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    this.lastExpanded = expanded;
    const copy = featureCopy(this.language());
    for (const grip of [this.seek, this.controls].map(e => e.querySelector<HTMLElement>('.claude-ra-grip')!)) { grip.title = copy.drag; grip.setAttribute('aria-label', copy.drag); }
    this.circle.title = this.circle.getAttribute('aria-label') + ' · ' + copy.drag;
    this.positionPopovers();
  }
  private reducedMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  private place(el: HTMLElement, r: Rect) { for (const [key, value] of Object.entries({ left: r.x, top: r.y, width: r.width, height: r.height })) if (el.style.getPropertyValue(key) !== value + 'px') el.style.setProperty(key, value + 'px'); }
  positionPopovers(): void {
    const v = this.viewport();
    this.more.setAttribute('aria-expanded', String(this.extras.classList.contains('claude-open')));
    for (const wrap of this.controls.querySelectorAll<HTMLElement>('.claude-ra-volume-wrap, .claude-ra-download-wrap')) wrap.querySelector('button')?.setAttribute('aria-expanded', String(wrap.classList.contains('claude-open')));
    for (const pop of this.controls.querySelectorAll<HTMLElement>('.claude-ra-extras, .claude-ra-popover, .claude-ra-volume-popover')) {
      const trigger = (pop === this.extras ? this.more : pop.parentElement!).getBoundingClientRect();
      const above = Math.max(44, trigger.top - v.y - 8), below = Math.max(44, v.y + v.height - trigger.bottom - 8), placeAbove = above >= below;
      pop.style.maxWidth = v.width + 'px'; pop.style.maxHeight = (pop.classList.contains('claude-ra-help') ? v.height : Math.min(v.height, placeAbove ? above : below)) + 'px';
      const w = pop.offsetWidth || 180, h = pop.offsetHeight || 200;
      if (pop === this.extras && this.controls.classList.contains('claude-ra-vertical')) {
        const rail = bounds(this.controls);
        const y = Math.max(v.y, Math.min(v.y + v.height - h, trigger.top));
        const left = { x: rail.x - w - 8, y, width: w, height: h };
        const right = { ...left, x: rail.x + rail.width + 8 };
        const sides = rail.x < v.x + v.width / 2 ? [right, left] : [left, right];
        const target = sides.find(r => fits(r, v));
        if (target) { pop.style.left = target.x + 'px'; pop.style.top = target.y + 'px'; continue; }
      }
      if (pop.classList.contains('claude-ra-volume-popover')) {
        let rail = bounds(this.controls); const gap = 8;
        if (this.controls.classList.contains('claude-ra-compact-controls') && this.extras.classList.contains('claude-open')) {
          const extras = bounds(this.extras);
          const right = Math.max(rail.x + rail.width, extras.x + extras.width), bottom = Math.max(rail.y + rail.height, extras.y + extras.height);
          rail = { x: Math.min(rail.x, extras.x), y: Math.min(rail.y, extras.y), width: 0, height: 0 };
          rail.width = right - rail.x; rail.height = bottom - rail.y;
        }
        pop.style.maxHeight = v.height + 'px';
        const height = pop.offsetHeight || 165;
        const left = { x: rail.x - w - gap, y: Math.max(v.y, Math.min(v.y + v.height - height, trigger.top)), width: w, height };
        const right = { ...left, x: rail.x + rail.width + gap };
        const top = { ...left, x: Math.max(v.x, Math.min(v.x + v.width - w, trigger.left)), y: rail.y - height - gap };
        const bottom = { ...top, y: rail.y + rail.height + gap };
        const sides = rail.x + rail.width / 2 > v.x + v.width / 2 ? [left, right] : [right, left];
        const sideways = this.controls.classList.contains('claude-ra-vertical') || this.circle.dataset.preset?.startsWith('top');
        const target = (sideways ? [...sides, top, bottom] : [top, bottom, ...sides]).find(r => fits(r, v));
        if (target) { pop.style.left = target.x + 'px'; pop.style.top = target.y + 'px'; continue; }
      }
      pop.style.left = Math.max(v.x, Math.min(v.x + v.width - w, trigger.left)) + 'px';
      pop.style.top = Math.max(v.y, Math.min(v.y + v.height - h, placeAbove ? trigger.top - h - 8 : trigger.bottom + 8)) + 'px';
    }
  }
  private paintJoin(element: HTMLElement, surface: Rect, color: string): void {
    if (!this.composer) return;
    const style = getComputedStyle(this.composer), composer = bounds(this.composer);
    // Paint only outside the native rounded silhouette. The transparent center
    // leaves its border, shadow, input and buttons completely untouched.
    let height = 0;
    for (const [side, value] of [['left', style.borderTopLeftRadius], ['right', style.borderTopRightRadius]]) {
      const [x, y = x] = value.split(' ');
      const pixels = (v: string, size: number) => (parseFloat(v) || 0) * (v.endsWith('%') ? size / 100 : 1);
      const rx = pixels(x, composer.width), ry = pixels(y, composer.height);
      const scale = Math.min(1, composer.width / (2 * rx || 1), composer.height / (2 * ry || 1));
      element.style.setProperty('--join-' + side + '-x', rx * scale + 'px');
      element.style.setProperty('--join-' + side + '-y', ry * scale + 'px');
      height = Math.max(height, ry * scale);
    }
    element.style.setProperty('--join-color', color);
    this.place(element, { x: surface.x, y: surface.y + surface.height, width: surface.width, height });
  }
  private installDrag(handle: HTMLElement, pill?: HTMLElement): void {
    let suppressClick = false;
    handle.addEventListener('click', event => { if (suppressClick && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; } }, true);
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary) return;
      this.cancelDrag?.(); suppressClick = false;
      const key = layoutProfile(innerWidth), current = this.preferences[key];
      // Mobile has one fixed destination; the circle still expands/collapses.
      if (!pill && key === 'narrow') return;
      const x = event.clientX, y = event.clientY;
      let dragging = false, selected: LayoutProfile | null = null, done = false;
      const offsets = new Map<HTMLElement, { x: number; y: number }>();
      const originals = new Map<HTMLElement, Rect>();
      let preview: HTMLElement | null = null, previewScale = 1;
      let previewContents: HTMLElement | null = null, liftPending = false;
      let previewBounds: Rect = { x, y, width: 0, height: 0 };
      let targets: { element: HTMLElement; profile: LayoutProfile; hit: Rect; parts: Rect[] }[] = [];
      const moving = pill ? [pill] : [this.seek, this.controls, this.circle, this.surface, this.join].filter(el => !el.hidden && (this.expanded || el === this.circle));
      handle.setPointerCapture(event.pointerId);
      const move = (e: PointerEvent) => {
        if (e.pointerId !== event.pointerId) return;
        if (!dragging && Math.hypot(e.clientX - x, e.clientY - y) <= 8) return;
        if (!dragging) {
          dragging = this.dragging = true; suppressClick = true;
          this.controls.querySelectorAll('.claude-open').forEach(el => el.classList.remove('claude-open'));
          for (const el of moving) {
            const visible = bounds(el); el.getAnimations().forEach(a => a.cancel()); el.style.transform = '';
            const resting = bounds(el); offsets.set(el, { x: visible.x - resting.x, y: visible.y - resting.y });
            originals.set(el, visible);
            el.classList.add('claude-ra-dragging');
          }
          this.overlay = document.createElement('div'); this.overlay.id = 'claude-ra-drop-targets'; this.overlay.setAttribute('aria-hidden', 'true');
          this.overlay.classList.toggle('claude-ra-group-drag', !pill);
          if (!pill) {
            const rects = [...originals.values()];
            const left = Math.min(...rects.map(r => r.x)), top = Math.min(...rects.map(r => r.y));
            previewBounds = { x: left, y: top, width: Math.max(...rects.map(r => r.x + r.width)) - left, height: Math.max(...rects.map(r => r.y + r.height)) - top };
            previewScale = Math.min(1, 240 / previewBounds.width, 120 / previewBounds.height);
            preview = document.createElement('div'); preview.className = 'claude-ra-drag-preview'; preview.inert = true;
            const shadow = preview.attachShadow({ mode: 'closed' });
            const style = document.createElement('style'); style.textContent = typeof __PLAYER_CSS__ === 'string' ? __PLAYER_CSS__ : '';
            previewContents = document.createElement('div');
            Object.assign(previewContents.style, { position: 'relative', width: previewBounds.width + 'px', height: previewBounds.height + 'px', transformOrigin: '0 0' });
            shadow.append(style, previewContents);
            for (const el of moving) {
              const clone = el.cloneNode(true) as HTMLElement, r = originals.get(el)!;
              // Keep ID-based player styling inside the inert visual preview;
              // use a shadow root so IDs never duplicate document controls.
              clone.classList.remove('claude-ra-dragging');
              this.place(clone, { ...r, x: r.x - left, y: r.y - top });
              clone.style.position = 'absolute'; clone.style.transform = 'none'; clone.style.opacity = '1';
              previewContents.append(clone);
              el.classList.add('claude-ra-drag-source');
            }
            preview.style.width = previewBounds.width + 'px'; preview.style.height = previewBounds.height + 'px';
            this.overlay.append(preview);
            liftPending = !this.reducedMotion();
          }
          const profiles: LayoutProfile[] = pill ? [{ ...current, seekFirst: !current.seekFirst }] : PRESETS.map(preset => ({ preset, seekFirst: current.seekFirst }));
          for (const profile of profiles) {
            const geometry = this.geometry(profile, true); if (!geometry) continue;
            const element = document.createElement('div'); element.className = 'claude-ra-drop-target';
            element.dataset.preset = profile.preset; element.dataset.seekFirst = String(profile.seekFirst);
            if (!pill && geometry.attachedToComposer && geometry.surface) {
              const join = document.createElement('div'); join.className = 'claude-ra-dock-join';
              this.paintJoin(join, geometry.surface, 'var(--claude-drop-fill)'); join.classList.add('claude-ra-target-detail'); element.append(join);
            }
            const parts: [string, Rect][] = pill
              ? [[pill === this.seek ? 'seek' : 'controls', pill === this.seek ? geometry.seek : geometry.controls]]
              : geometry.surface ? [['surface', geometry.surface], ['circle', geometry.circleVisual || geometry.circle]] : [['seek', geometry.seek], ['controls', geometry.controls], ['circle', geometry.circle]];
            for (const [kind, r] of parts) {
              const outline = document.createElement('div'); outline.className = 'claude-ra-drop-shape'; outline.dataset.part = kind;
              if (!pill) outline.classList.add('claude-ra-target-detail');
              this.place(outline, r);
              const native = this.composer && getComputedStyle(this.composer);
              outline.style.borderRadius = kind === 'surface' ? (native?.borderTopLeftRadius || '14px') + ' ' + (native?.borderTopRightRadius || '14px') + ' 0 0' : geometry.surface && kind !== 'circle' ? '0' : (native?.borderTopLeftRadius || '14px');
              element.append(outline);
            }
            const hit = pill ? pill === this.seek ? geometry.seek : geometry.controls : geometry.circle;
            if (!pill) {
              const marker = document.createElement('div'); marker.className = 'claude-ra-drop-shape claude-ra-drop-marker'; marker.dataset.part = 'marker';
              marker.style.borderRadius = this.composer ? getComputedStyle(this.composer).borderTopLeftRadius : '14px';
              this.place(marker, hit);
              element.append(marker);
            }
            this.overlay.append(element); targets.push({ element, profile, hit, parts: parts.map(([, r]) => r) });
          }
          document.body.append(this.overlay);
        }
        e.preventDefault();
        const nearest = targets.map(target => ({ target, distance: distanceToRect(e.clientX, e.clientY, target.hit) })).filter(t => t.distance <= 24).sort((a, b) => a.distance - b.distance)[0]?.target;
        selected = nearest?.profile || null;
        for (const target of targets) target.element.classList.toggle('claude-ra-drop-active', target === nearest);
        const pull = nearest && !this.reducedMotion() ? magneticOffset(e.clientX, e.clientY, nearest.hit) : null;
        const px = e.clientX + (pull?.x || 0), py = e.clientY + (pull?.y || 0);
        if (preview) {
          // Offset the thumbnail from the cursor so the active circle stays visible.
          const v = this.viewport();
          const width = previewBounds.width * previewScale, height = previewBounds.height * previewScale;
          const candidates = [1, -1].flatMap(dy => [1, -1].map(dx => ({ width, height,
            x: Math.max(v.x, Math.min(px + (dx > 0 ? 32 : -width - 32), v.x + v.width - width)),
            y: Math.max(v.y, Math.min(py + (dy > 0 ? 32 : -height - 32), v.y + v.height - height)) })));
          const position = candidates.find(r => !nearest?.parts.some(part => intersects(r, part))) || candidates[0];
          const left = position.x, top = position.y;
          preview.style.transform = `translate(${left}px,${top}px) scale(${previewScale})`;
          if (liftPending && previewContents) {
            // Animate inside the translated wrapper: scaling the wrapper itself
            // would also magnify its pointer offset and fling the preview away.
            previewContents.animate([{ transform: `translate(${(previewBounds.x - left) / previewScale}px,${(previewBounds.y - top) / previewScale}px) scale(${1 / previewScale})` }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' });
            liftPending = false;
          }
          for (const el of moving) {
            const r = originals.get(el)!;
            el.style.transformOrigin = '0 0';
            el.style.transform = `translate(${left + (r.x - previewBounds.x) * previewScale - r.x}px,${top + (r.y - previewBounds.y) * previewScale - r.y}px) scale(${previewScale})`;
          }
        } else for (const el of moving) el.style.transform = 'translate(' + (e.clientX - x + (offsets.get(el)?.x || 0) + (pull?.x || 0)) + 'px,' + (e.clientY - y + (offsets.get(el)?.y || 0) + (pull?.y || 0)) + 'px)';
      };
      const finish = (commit: boolean) => {
        if (done) return; done = true;
        handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', cancel); handle.removeEventListener('lostpointercapture', cancel);
        window.removeEventListener('keydown', escape); window.removeEventListener('resize', cancel); window.removeEventListener('scroll', cancel, true);
        window.visualViewport?.removeEventListener('resize', cancel); window.visualViewport?.removeEventListener('scroll', cancel);
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        this.overlay?.remove(); this.overlay = null; this.cancelDrag = null; this.dragging = false;
        moving.forEach(el => el.classList.remove('claude-ra-dragging', 'claude-ra-drag-source'));
        if (dragging) {
          // Force a FLIP from the current dragged position, including invalid drops.
          this.previous = 'drag';
          if (commit && selected) void this.save({ ...this.preferences, [key]: selected });
          else this.changed();
        }
      };
      const up = () => finish(true), cancel = () => finish(false), escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); finish(false); } };
      this.cancelDrag = cancel;
      handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', cancel); handle.addEventListener('lostpointercapture', cancel);
      window.addEventListener('keydown', escape); window.addEventListener('resize', cancel); window.addEventListener('scroll', cancel, true);
      window.visualViewport?.addEventListener('resize', cancel); window.visualViewport?.addEventListener('scroll', cancel);
    });
  }
}
