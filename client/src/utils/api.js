const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

const STORAGE_KEYS = {
  accessToken: 'tfounz_access_token',
  refreshToken: 'tfounz_refresh_token',
  user: 'tfounz_user',
};

let refreshPromise = null;

export function getStoredTokens() {
  return {
    accessToken: localStorage.getItem(STORAGE_KEYS.accessToken) || '',
    refreshToken: localStorage.getItem(STORAGE_KEYS.refreshToken) || '',
  };
}

export function setStoredAuth({ user, accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
  if (refreshToken) localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
  if (user) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.user);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token, bufferMs = 30000) {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    if (!payload?.exp) return false;
    return payload.exp * 1000 <= Date.now() + bufferMs;
  } catch {
    return true;
  }
}

async function performTokenRefresh() {
  if (refreshPromise) return refreshPromise;

  const { refreshToken } = getStoredTokens();
  if (!refreshToken) {
    throw new Error('Session expired');
  }

  refreshPromise = (async () => {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.data?.accessToken) {
      clearStoredAuth();
      throw new Error(data?.message || 'Session expired, please log in again');
    }

    setStoredAuth(data.data);
    return data.data.accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/**
 * Ensures we hold a fresh, non-expired JWT access token BEFORE issuing HTTP or Socket.IO requests,
 * preventing unnecessary 401 console errors after the 15-minute access token expires.
 */
export async function ensureFreshAccessToken() {
  const { accessToken, refreshToken } = getStoredTokens();
  if (accessToken && !isTokenExpiringSoon(accessToken)) {
    return accessToken;
  }
  if (refreshToken) {
    return performTokenRefresh();
  }
  return accessToken;
}

export async function apiFetch(
  path,
  options = {},
  { skipAuth = false, rawResponse = false } = {}
) {
  let token = '';
  if (!skipAuth) {
    token = await ensureFreshAccessToken().catch(() => getStoredTokens().accessToken);
  }

  const isFormData = options.body instanceof FormData;
  const headers = new Headers(options.headers || {});
  if (!isFormData && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!skipAuth && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !skipAuth && getStoredTokens().refreshToken) {
    const newAccessToken = await performTokenRefresh();
    headers.set('Authorization', `Bearer ${newAccessToken}`);
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  }

  if (rawResponse) {
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const err = new Error(errData?.message || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res;
  }

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.details = payload?.details || null;
    throw err;
  }

  return payload;
}

export async function apiFetchBlobUrl(path) {
  const res = await apiFetch(path, { method: 'GET' }, { rawResponse: true });
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function getApiBase() {
  return API_BASE;
}
