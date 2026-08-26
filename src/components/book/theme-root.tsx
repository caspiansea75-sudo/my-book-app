import { useEffect, type ReactNode } from "react";
import { useReaderStore } from "@/lib/reader-store";
import { RainLayer } from "@/components/book/rain-layer";

export function ThemeRoot({ children }: { children: ReactNode }) {
  const theme = useReaderStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--book-bg")
      .trim();
    if (meta && bg) meta.setAttribute("content", bg);
  }, [theme]);

  return (
    <div className="relative min-h-dvh bg-bg text-fg">
      {children}
      <RainLayer />
      <div className="book-grain" aria-hidden="true" />
      <div className="book-vignette" aria-hidden="true" />
    </div>
  );
}
