// Native dialog provides focus containment, background inertness and Escape handling.
export function installImageViewer(): void {
  const dialog = document.querySelector<HTMLDialogElement>('.image-viewer');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const image = dialog.querySelector('img')!;
  const caption = dialog.querySelector('figcaption')!;
  const close = dialog.querySelector('button')!;
  let opener: HTMLAnchorElement | null = null;
  let previousOverflow = '';
  for (const thumbnail of document.querySelectorAll<HTMLImageElement>('main figure img')) {
    let link = thumbnail.closest('a');
    if (!link) {
      link = document.createElement('a'); link.href = thumbnail.src;
      thumbnail.before(link); link.append(thumbnail);
    }
    link.classList.add('image-viewer-trigger'); link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', event => {
      if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); opener = link;
      image.src = link.href; image.alt = thumbnail.alt;
      caption.textContent = thumbnail.closest('figure')?.querySelector('figcaption')?.textContent || thumbnail.alt;
      if (!dialog.open) previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      if (!dialog.open) dialog.showModal();
      close.focus();
    });
  }
  close.addEventListener('click', () => dialog.close());
  // This viewer has one focusable control; keep Tab/Shift+Tab inside the modal.
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Tab') { event.preventDefault(); close.focus(); }
    const carousel = opener?.closest('.layout-carousel');
    if (!carousel || event.altKey || event.ctrlKey || event.metaKey) return;
    const links = [...carousel.querySelectorAll<HTMLAnchorElement>('figure a')];
    const current = links.indexOf(opener!);
    const direction = document.documentElement.dir === 'rtl' ? -1 : 1;
    let index: number;
    if (event.key === 'ArrowRight') index = current + direction;
    else if (event.key === 'ArrowLeft') index = current - direction;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = links.length - 1;
    else return;
    event.preventDefault();
    links[(index + links.length) % links.length].click();
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    document.documentElement.style.overflow = previousOverflow;
    image.removeAttribute('src'); opener?.focus({ preventScroll: true });
  });
}
