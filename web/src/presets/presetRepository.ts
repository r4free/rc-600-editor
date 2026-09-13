import {
  newPresetId,
  normalizePresetName,
  resolvePresetSaveTarget,
  type DrumPreset,
  type DrumPresetPayload,
  type DrumPresetSource,
} from "./drumPreset";
import { nativePresetApi, type NativePresetApi } from "./nativePresetApi";
import { userPresetStore, type UserPresetStore } from "./userPresetStore";

export interface PresetRepository {
  /** Factory JSON catalog + this-browser user list. */
  list(): Promise<{ native: DrumPreset[]; user: DrumPreset[] }>;
  save(input: {
    name: string;
    payload: DrumPresetPayload;
    /** Reuse id when overwriting the currently selected preset in the save target. */
    id?: string;
  }): Promise<DrumPreset>;
  remove(id: string, source: DrumPresetSource): Promise<void>;
  saveTarget(): DrumPresetSource;
}

export function createPresetRepository(deps: {
  mode: string | undefined;
  native: NativePresetApi;
  user: UserPresetStore;
}): PresetRepository {
  const saveTarget = () => resolvePresetSaveTarget(deps.mode);

  return {
    saveTarget,
    async list() {
      const [native, user] = await Promise.all([deps.native.list(), Promise.resolve(deps.user.list())]);
      return { native, user };
    },
    async save(input) {
      const name = normalizePresetName(input.name);
      const target = saveTarget();
      const preset: DrumPreset = {
        id: input.id?.trim() || newPresetId(target, name),
        name,
        source: target,
        updatedAt: new Date().toISOString(),
        payload: input.payload,
      };
      if (target === "native") return deps.native.upsert(preset);
      return deps.user.upsert(preset);
    },
    async remove(id, source) {
      if (source === "native") {
        if (saveTarget() !== "native") {
          throw new Error("Factory rhythms can only be deleted in development");
        }
        await deps.native.remove(id);
        return;
      }
      deps.user.remove(id);
    },
  };
}

/** Browser default: Vite MODE chooses file (development) vs localStorage (production). */
export function browserPresetRepository(): PresetRepository {
  return createPresetRepository({
    mode: import.meta.env.MODE,
    native: nativePresetApi,
    user: userPresetStore,
  });
}
