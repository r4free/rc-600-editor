import { deleteStoredValue, loadStoredValue, saveStoredValue } from "@rc600/files/folder-store";
import { parseProject, type Rc600Project } from "./projectFile";

/** One autosave per source (offline, a ZIP, a folder) so switching sources keeps the others. */
function keyFor(label: string): string {
  return `editorAutosave:${label}`;
}

export async function saveAutosave(label: string, project: Rc600Project): Promise<void> {
  await saveStoredValue(keyFor(label), JSON.stringify(project));
}

export async function loadAutosave(label: string): Promise<Rc600Project | null> {
  const raw = await loadStoredValue<string>(keyFor(label));
  if (typeof raw !== "string") return null;
  try {
    return parseProject(raw);
  } catch {
    return null;
  }
}

export async function clearAutosave(label: string): Promise<void> {
  await deleteStoredValue(keyFor(label));
}
