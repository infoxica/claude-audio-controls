/** Keep audio ownership and floating UI on chat surfaces, including SPA navigation. */
export function isClaudeChatRoute(path = location.pathname, hash = location.hash): boolean {
  return !/^#\/?settings(?:[/?]|$)/i.test(hash) && (path === '/' || path === '/new' || /^\/chat\/[^/]+\/?$/.test(path));
}
