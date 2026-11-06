/*
 * Self-contained inline Lucide & Claude SVGs for zero-CSP-violation rendering.
 * Does not depend on external fonts or CDNs.
 */
const BRAND_SVG = "<svg width=\"512\" height=\"512\" viewBox=\"0 0 512 512\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path d=\"M224.84 111.811L207.109 72.3961L195.173 45.0876L183.727 35.1442L160.756 32.0807L148.169 36.1295L130.993 59.4557V62.7399C130.993 68.6011 132.003 73.345 133.107 78.0299L133.149 78.2086L136.617 90.8219L148.769 110.322L174.394 154.474L183.281 170.539L162.41 155.167L128.487 128.91L128.475 128.9L128.463 128.891L110.961 115.425L104.078 113.592L82.5765 112.13L64.4125 132.132L68.3539 157.414L77.4291 168.91L91.4437 178.462L115.153 195.706L115.332 195.836L160.961 226.024L181.559 239.982L162.243 237.976L162.02 237.953L161.796 237.939L132.336 236.206L64.8431 231.568L49.1898 230.202L34.0853 240.356L31.7699 255.139L46.1176 274.053L60.6859 277.157L101.872 279.365L101.932 279.369L101.993 279.371L143.768 281.106L185.348 282.23L121.311 318.161L120.622 318.413L85.7621 342.404L78.5131 350.061L76.7758 371.693L92.3988 386.327L119.462 382.833L188.806 337.806L179.975 349.351L137.188 403.778L136.992 404.068L128.436 416.676L126.32 437.762L149.161 449.596L162.851 444.173L195.535 409.187L234.748 356.193L234.771 356.163L234.792 356.132L238.102 351.589L236.99 359.004L231.414 386.03L231.411 386.051L231.407 386.072L224.486 420.354L218.074 449.71L226.136 468.387L243.484 481.572L264.06 473.706L273.4 462.739L283.291 356.188L290.09 367.76L315.462 406.629L315.574 406.798L315.691 406.965L342.509 444.614L361.002 447.979L378.229 441.962L384.319 429.372L381.56 404.831L362.825 376.669L367.658 380.913L367.959 381.139L409.321 412.259L423.974 414.352L435.814 397.636L431.897 379.987L384.881 336.28L384.828 336.231L384.775 336.182L352.71 307.229L448.188 329.924L477.638 314.924L480.55 297.09L468.551 280.9L450.844 269.191L394.412 264.982L394.04 264.955H390.745L429.843 257.134L470.106 247.193L479.037 225.129L475.622 210.254L453.518 199.933L417.623 206.093L417.579 206.101L417.536 206.109L390.043 211.076L389.891 211.103L389.739 211.135L354.506 218.633L358.714 211.375L380.852 181.575L396.439 161.377L416.588 135.822L424.507 108.666L405.375 80.2321L378.183 80.234L365.143 90.529L349.471 107.215L349.378 107.314L349.288 107.416L336.119 122.223L335.955 122.426L306.496 159.25L306.406 159.364L306.318 159.481L304.744 161.57L304.975 160.34L314.974 108.402L315.002 108.216L320.086 75.1774L320.092 75.1364L321.866 63.2838L309.527 45.612L291.653 37.071L271.055 50.653L262.632 71.0631L261.066 86.0465L261.056 86.1413L261.047 86.236L256.956 134.202L253.236 167.173L252.47 165.66L252.458 165.636L252.446 165.612L224.84 111.811Z\" fill=\"#CC785C\"/>\n<path d=\"M333.676 255.962C333.676 292.563 304.005 322.234 267.404 322.234C230.803 322.234 201.132 292.563 201.132 255.962C201.132 219.361 230.803 189.69 267.404 189.69C304.005 189.69 333.676 219.361 333.676 255.962Z\" fill=\"#F0F0EB\"/>\n<path d=\"M301.396 254.783C304.063 256.322 304.063 260.171 301.396 261.711L253.408 289.417C250.742 290.956 247.408 289.032 247.408 285.953L247.408 230.541C247.408 227.462 250.742 225.538 253.408 227.077L301.396 254.783Z\" fill=\"#262625\"/>\n</svg>";
export const LUCIDE_ICONS: Record<string, string> = {
  coffee: '<path d="M10 2v2M14 2v2M4 2v2M4 7h14v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4ZM18 8h1a3 3 0 1 1 0 6h-1M2 22h20"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"></path>',
  check: '<path d="m5 12 4 4L19 6"></path>',
  ellipsis: '<circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle>',
  "chevron-up": '<path d="m18 15-6-6-6 6"></path>',
  "chevron-down": '<path d="m6 9 6 6 6-6"></path>',
  "grip-vertical": '<circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle>',
  play: '<polygon points="6 3 20 12 6 21 6 3"></polygon>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect>',
  square: '<rect x="5" y="5" width="14" height="14" rx="2"></rect>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line>',
  "volume-2": '<path d="M11 5 6 9H2v6h4l5 4V5Z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>',
  "volume-1": '<path d="M11 5 6 9H2v6h4l5 4V5Z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>',
  "volume-x": '<path d="M11 5 6 9H2v6h4l5 4V5Z"></path><line x1="22" x2="16" y1="9" y2="15"></line><line x1="16" x2="22" y1="9" y2="15"></line>',
  "circle-help": '<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 1 1 5.83 1c0 2-3 2-3 4"></path><path d="M12 17h.01"></path>',
  "rotate-ccw": '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5"></path>',
  "rotate-cw": '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"></path><path d="M21 3v5h-5"></path>',
  "loader-circle": '<path d="M21 12a9 9 0 1 1-6.22-8.56"></path>',
  "chevron-right": '<polyline points="9 18 15 12 9 6"></polyline>',
  "chevron-left": '<polyline points="15 18 9 12 15 6"></polyline>',
  "minimize-2": '<polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line>',

};

export function getLucideSvg(name: string, className = ""): string {
  if (name === 'claude-audio') return BRAND_SVG.replace('<svg ', `<svg class="claude-ra-lucide ${className}" aria-hidden="true" focusable="false" `).replace('width="512" height="512"', 'width="18" height="18"');
  const body = LUCIDE_ICONS[name] || LUCIDE_ICONS["circle-help"];
  return `
    <svg
      class="claude-ra-lucide ${className}"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >${body}</svg>
  `;
}

export function setIcon(button: HTMLElement | null, iconName: string, extraHTML = ""): void {
  if (!button) return;

  // updateControls() runs for every media timeupdate. Avoid rebuilding the
  // SVG subtree when the icon did not change; doing so creates mutation
  // records and needlessly invalidates layout/style work on the host page.
  const iconKey = `${iconName}\u0000${extraHTML}`;
  if (button.dataset.claudeRaIcon === iconKey) return;

  button.dataset.claudeRaIcon = iconKey;
  button.innerHTML = getLucideSvg(iconName) + extraHTML;
}
