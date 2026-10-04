import type { ComponentProps } from "react";
import { InputFxTab } from "./InputFxTab";

/** Track FX use the same Setup / Bank A–D pages as Input FX, plus the Track-only Beat effects. */
export function TrackFxTab(props: Omit<ComponentProps<typeof InputFxTab>, "kind" | "pedalMemories">) {
  return <InputFxTab {...props} kind="tfx" />;
}
