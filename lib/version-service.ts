import { Platform } from 'react-native';

const STORED_BUILD_KEY = 'app_build_id';

interface VersionInfo {
  version: string;
  buildId: string;
  builtAt: string;
}

async function fetchVersionInfo(): Promise<VersionInfo | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as VersionInfo;
  } catch {
    return null;
  }
}

function getStoredBuildId(): string | null {
  try {
    return localStorage.getItem(STORED_BUILD_KEY);
  } catch {
    return null;
  }
}

function storeBuildId(buildId: string): void {
  try {
    localStorage.setItem(STORED_BUILD_KEY, buildId);
  } catch {}
}

/**
 * Checks whether the deployed buildId differs from the one stored in
 * localStorage.  If it does, the stored id is updated and the page is
 * reloaded so users always run the latest build.
 *
 * All user-specific data stored under other keys (userData, theme, etc.)
 * is preserved — only the build tracking key is written.
 */
export async function checkAndApplyUpdate(): Promise<void> {
  if (Platform.OS !== 'web') return;

  const remote = await fetchVersionInfo();
  if (!remote) return;

  const storedBuildId = getStoredBuildId();

  if (storedBuildId === null) {
    storeBuildId(remote.buildId);
    return;
  }

  if (storedBuildId !== remote.buildId) {
    storeBuildId(remote.buildId);
    window.location.reload();
  }
}
