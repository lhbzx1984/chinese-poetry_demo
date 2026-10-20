"use client";
import { useEffect, useRef } from "react";
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.classList.add("reveal-ready");
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        element.classList.add("revealed");
        element.dispatchEvent(new CustomEvent("shijing:reveal", { bubbles: true }));
        observer.disconnect();
      }
    }, { threshold: .12 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return ref;
}
