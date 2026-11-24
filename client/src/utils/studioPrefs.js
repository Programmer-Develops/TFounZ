const PREFS_KEY = 'tfounz_studio_prefs';

const DEFAULT_PREFS = {
  videoDeviceId: '',
  audioDeviceId: '',
  defaultVoiceEngine: 'browser', // 'browser' | 'sounz'
  mirrorCamera: true,
  showStarters: true,
};

export function getStudioPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveStudioPrefs(partial) {
  const next = { ...getStudioPrefs(), ...partial };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}

/**
 * Strips leading Unicode emojis from upstream SounZ AI labels so UI remains strictly icon-driven.
 */
export function cleanVoiceLabel(label = '') {
  return String(label)
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/gu, '')
    .trim();
}
