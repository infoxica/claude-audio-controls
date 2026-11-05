export const requiredGates = ['nativePcm', 'nativeOpus', 'singleAudiblePlayer', 'downloadsDecoded', 'chromeWindows', 'edgeWindows', 'chromeMacOS', 'edgeMacOS', 'edgeAndroidLive', 'userscriptLive', 'websiteStaging', 'localizationReviewed'] as const;
export function acceptanceComplete(value: unknown, version: string): boolean {
  const state = value as Record<string, unknown> | null;
  return Boolean(state && state.version === version && requiredGates.every(key => state[key] === true));
}
