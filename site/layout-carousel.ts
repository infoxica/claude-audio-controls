export function installLayoutCarousel(): void {
  const root = document.querySelector<HTMLElement>('.layout-carousel');
  if (!root) return;
  const slides = [...root.querySelectorAll<HTMLElement>('figure')];
  const previous = root.querySelector<HTMLButtonElement>('[data-layout-previous]')!;
  const next = root.querySelector<HTMLButtonElement>('[data-layout-next]')!;
  const picker = root.querySelector<HTMLSelectElement>('select')!;
  const status = root.querySelector<HTMLElement>('[role="status"]')!;
  const rtl = document.documentElement.dir === 'rtl';
  let current = 0;
  const wrap = (index: number) => (index + slides.length) % slides.length;
  const title = (index: number) => `${index + 1} / ${slides.length} · ${slides[index].querySelector('figcaption')!.textContent}`;
  function show(index: number) {
    current = wrap(index);
    slides.forEach((slide, i) => { slide.hidden = i !== current; });
    picker.value = String(current);
    status.textContent = title(current);
    previous.setAttribute('aria-label', title(wrap(current - 1)));
    next.setAttribute('aria-label', title(wrap(current + 1)));
  }
  slides.forEach((slide, i) => slide.querySelector('a')!.addEventListener('click', () => show(i)));
  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  picker.addEventListener('change', () => show(Number(picker.value)));
  root.addEventListener('keydown', event => {
    if (event.target instanceof HTMLSelectElement || event.altKey || event.ctrlKey || event.metaKey) return;
    let index: number;
    if (event.key === 'ArrowRight') index = current + (rtl ? -1 : 1);
    else if (event.key === 'ArrowLeft') index = current + (rtl ? 1 : -1);
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = slides.length - 1;
    else return;
    event.preventDefault();
    const imageFocused = event.target instanceof Element && !!event.target.closest('figure');
    show(index);
    if (imageFocused) slides[current].querySelector('a')!.focus({preventScroll:true});
  });
  root.querySelector<HTMLElement>('.layout-carousel-controls')!.hidden = false;
  show(0);
}
