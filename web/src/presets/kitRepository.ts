import {
  newKitId,
  normalizeKitName,
  parseKitNotes,
  type DrumKit,
  type DrumKitSource,
} from "./drumKit";
import { resolvePresetSaveTarget } from "./drumPreset";
import { nativeKitApi, type NativeKitApi } from "./nativeKitApi";
import { userKitStore, type UserKitStore } from "./userKitStore";

export interface KitRepository {
  list(): Promise<{ native: DrumKit[]; user: DrumKit[] }>;
  save(input: {
    name: string;
    padCount: number;
    notes: readonly number[];
    id?: string;
  }): Promise<DrumKit>;
  remove(id: string, source: DrumKitSource): Promise<void>;
  saveTarget(): DrumKitSource;
}

export function createKitRepository(deps: {
  mode: string | undefined;
  native: NativeKitApi;
  user: UserKitStore;
}): KitRepository {
  const saveTarget = () => resolvePresetSaveTarget(deps.mode);

  return {
    saveTarget,
    async list() {
      const [native, user] = await Promise.all([deps.native.list(), Promise.resolve(deps.user.list())]);
      return { native, user };
    },
    async save(input) {
      const name = normalizeKitName(input.name);
      const target = saveTarget();
      const notes = parseKitNotes(input.notes, input.padCount);
      const kit: DrumKit = {
        id: input.id?.trim() || newKitId(target, name),
        name,
        source: target,
        updatedAt: new Date().toISOString(),
        padCount: notes.length,
        notes,
      };
      if (target === "native") return deps.native.upsert(kit);
      return deps.user.upsert(kit);
    },
    async remove(id, source) {
      if (source === "native") {
        if (saveTarget() !== "native") {
          throw new Error("Factory kits can only be deleted in development");
        }
        await deps.native.remove(id);
        return;
      }
      deps.user.remove(id);
    },
  };
}

export function browserKitRepository(): KitRepository {
  return createKitRepository({
    mode: import.meta.env.MODE,
    native: nativeKitApi,
    user: userKitStore,
  });
}
