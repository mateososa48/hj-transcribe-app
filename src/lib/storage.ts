/**
 * Storage durability.
 *
 * Without a persistence grant the browser may evict IndexedDB under disk
 * pressure — which for this app means losing a recording, the one failure
 * SPEC constraint 6 forbids outright. So we request persistence on first
 * launch and surface the answer in Einstellungen rather than assuming it.
 */

export interface StorageStatus {
  persisted: boolean;
  /** Bytes currently used, when the browser will say. */
  usage?: number;
  /** Bytes available, when the browser will say. */
  quota?: number;
  supported: boolean;
}

export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    // Already granted? Don't re-prompt.
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageStatus(): Promise<StorageStatus> {
  if (!navigator.storage?.estimate) {
    return { persisted: false, supported: false };
  }
  const [persisted, estimate] = await Promise.all([
    navigator.storage.persisted?.() ?? Promise.resolve(false),
    navigator.storage.estimate(),
  ]);
  return {
    persisted,
    supported: true,
    ...(estimate.usage !== undefined ? { usage: estimate.usage } : {}),
    ...(estimate.quota !== undefined ? { quota: estimate.quota } : {}),
  };
}

/** German-formatted byte size for the settings screen. */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return 'unbekannt';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1).replace('.', ',')} ${units[unit]}`;
}
