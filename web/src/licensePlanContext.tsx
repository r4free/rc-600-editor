import { createContext, useContext, type ReactNode } from "react";

const PreviewContext = createContext(false);

export function PreviewProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return <PreviewContext.Provider value={enabled}>{children}</PreviewContext.Provider>;
}

export function usePreview(): boolean {
  return useContext(PreviewContext);
}
