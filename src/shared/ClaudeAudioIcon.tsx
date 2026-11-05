import type { SVGProps } from 'react';
export function ClaudeAudioIcon({ size = 20, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return <svg {...props} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden={props['aria-label'] ? undefined : true} focusable="false">
    <path d="M3 9v6M7 5v14M11 8v8"/><path d="m16 7 6 5-6 5z" fill="currentColor" strokeLinejoin="round"/>
  </svg>;
}
