import { create } from 'zustand';

import {
  DEFAULT_SETTINGS,
  loadApiKeys,
  loadSettings,
  saveSettings,
  type ApiKeyMap,
  type AppSettings,
} from '@/lib/settings';
import { getStorageStatus, requestPersistence, type StorageStatus } from '@/lib/storage';

interface SettingsState {
  settings: AppSettings;
  apiKeys: ApiKeyMap;
  storage: StorageStatus | null;
  loaded: boolean;

  hydrate: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  refreshStorage: () => Promise<void>;
  enablePersistence: () => Promise<boolean>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  apiKeys: {},
  storage: null,
  loaded: false,

  hydrate: async () => {
    const [settings, apiKeys, storage] = await Promise.all([
      loadSettings(),
      loadApiKeys(),
      getStorageStatus(),
    ]);
    set({ settings, apiKeys, storage, loaded: true });
  },

  update: async (patch) => {
    const settings = await saveSettings(patch);
    set({ settings });
  },

  refreshStorage: async () => {
    set({ storage: await getStorageStatus() });
  },

  enablePersistence: async () => {
    const granted = await requestPersistence();
    await get().update({ storagePersisted: granted });
    await get().refreshStorage();
    return granted;
  },
}));
