/**
 * The door key.
 *
 * The app is deployed on a public URL, and without this gate anyone who found
 * it could open the UI and spend the practice's transcription and drafting
 * credits. The gate keeps them out of the interface.
 *
 * Be clear about what it is NOT: there is no server, so the check runs in the
 * visitor's own browser. It cannot cryptographically protect the data on HJ's
 * machine, and it does not make the deployed bundle secret. It is a locked
 * front door, not a safe — which is exactly the job it was asked to do.
 *
 * Only the SHA-256 of the password lives in the source; the password itself is
 * never written into the repo or the bundle.
 */

const STORAGE_KEY = 'arztbrief.zugang';

/** SHA-256 of the password, hex. Change the password by replacing this hash. */
const PASSWORD_SHA256 = '0e3280d966f224c8f56afd0a9db843e03fe483af7457554b9b27e6462fc7aaf8';

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Unlocked once, unlocked until the browser data is cleared: HJ must not have
 * to retype a password every morning. Storing the hash (not a flag) means a
 * password change automatically locks every browser that knew the old one.
 */
export function isUnlocked(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === PASSWORD_SHA256;
  } catch {
    return false;
  }
}

export async function tryUnlock(password: string): Promise<boolean> {
  // crypto.subtle only exists in secure contexts (https, localhost) — which is
  // everywhere this app is served. Guarded anyway so a stray http:// LAN open
  // fails closed instead of throwing.
  if (!globalThis.crypto?.subtle) return false;
  if ((await sha256Hex(password.trim())) !== PASSWORD_SHA256) return false;
  try {
    localStorage.setItem(STORAGE_KEY, PASSWORD_SHA256);
  } catch {
    // Private mode with storage blocked: unlocked for this tab only.
  }
  return true;
}
