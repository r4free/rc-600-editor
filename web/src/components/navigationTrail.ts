export type ActiveTabGroup = { name: string; selected: string };

/** Explicit containment, never DOM order or a history of previously selected tabs. */
export function navigationTrail(groups: readonly ActiveTabGroup[]): ActiveTabGroup[] {
  const selected = new Map(groups.map(group => [group.name, group]));
  const path: ActiveTabGroup[] = [];
  let group: string | undefined = "Workspace";
  while (group) {
    const item = selected.get(group);
    if (!item) break;
    path.push(item);
    group = childGroup(item);
  }
  return path;
}

function childGroup({ name, selected }: ActiveTabGroup): string | undefined {
  if (name === "Workspace") return selected === "Memory" ? "Memory editor" : selected === "System" ? "System" : undefined;
  if (name === "Memory editor" || name === "System") {
    if (["Loop", "Input", "Output", "Mixer", "Ctl Func", "Input FX", "Track FX"].includes(selected)) return selected;
  }
  if (name === "Loop" && selected === "Tracks") return "Track";
  if (name === "Input" && selected === "EQ") return "Input EQ";
  if (name === "Output") return selected === "EQ" ? "Output EQ" : selected === "Routing" ? "Routing" : undefined;
  return undefined;
}
