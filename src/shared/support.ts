import config from '../../config/release.json';
export const SPONSOR_AMOUNTS = [1, 3, 5, 10] as const;
export const SPONSOR_URL = 'https://github.com/sponsors/infoxica';
export const COFFEE_URL = 'https://paypal.me/infoxica';
export function coffeeURL(amount: typeof SPONSOR_AMOUNTS[number]): string {
  if (!SPONSOR_AMOUNTS.includes(amount)) throw new Error('Unsupported contribution');
  return `${COFFEE_URL}/${amount}USD`;
}
export function sponsorURL(amount: typeof SPONSOR_AMOUNTS[number]): string {
  if (!SPONSOR_AMOUNTS.includes(amount)) throw new Error('Unsupported contribution');
  return `${SPONSOR_URL}/sponsorships?frequency=one-time&amount=${amount}`;
}
export const REVIEW_URLS = {
  chrome: config.chromeListingLive && config.chromeItemId ? `https://chromewebstore.google.com/detail/${config.chromeItemId}/reviews` : '',
  edge: config.edgeListingLive && config.edgeItemId ? `https://microsoftedge.microsoft.com/addons/detail/${config.edgeItemId}#review-section` : '',
};
export function reviewStores(agent: string): (keyof typeof REVIEW_URLS)[] {
  const stores: (keyof typeof REVIEW_URLS)[] = /Edg(A|iOS)?\//.test(agent) ? ['edge'] : /Chrome\//.test(agent) ? ['chrome'] : ['chrome', 'edge'];
  return stores.filter(store => Boolean(REVIEW_URLS[store]));
}
