import { lazy, Suspense } from "react";

/**
 * Compiled out of production builds. `import.meta.env.DEV` is false after `vite build`,
 * so the Issue key module is not in the bundle the hosted site serves.
 */
const DevLicenseButton = import.meta.env.DEV
  ? lazy(() => import("./DevLicenseButton"))
  : null;

export function DevLicenseSlot() {
  if (!DevLicenseButton) return null;
  return (
    <Suspense fallback={null}>
      <DevLicenseButton />
    </Suspense>
  );
}
