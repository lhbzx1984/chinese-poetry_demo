import { useId } from "react";
export function Seal({ children }: { children: string }) {
  const id = useId().replace(/:/g, "");
  return <span className="seal"><svg viewBox="0 0 64 64" aria-hidden="true"><defs><filter id={id}><feTurbulence baseFrequency=".12" numOctaves="2" seed="7" /><feDisplacementMap in="SourceGraphic" scale="2" /></filter></defs><rect x="3" y="3" width="58" height="58" rx="2" fill="currentColor" filter={`url(#${id})`} /></svg><span>{children.slice(0,4)}</span></span>;
}
