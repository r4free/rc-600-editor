import { createContext, useContext, type ReactNode } from "react";

const DemoModeContext = createContext(false);

export function DemoModeProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return <DemoModeContext.Provider value={enabled}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode(): boolean {
  return useContext(DemoModeContext);
}
