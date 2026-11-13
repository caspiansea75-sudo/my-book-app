import { useEffect } from "react";
import { startInstallCapture } from "@/lib/pwa-install";

/** Listens from the first page load, because the browser offers the install only once, early. */
export function InstallCapture() {
  useEffect(() => startInstallCapture(), []);
  return null;
}
