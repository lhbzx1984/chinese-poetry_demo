import type { HTMLAttributes } from "react";
export function PaperCard({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`paper-card ${className}`} {...props} />;
}
