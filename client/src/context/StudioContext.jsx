import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { useAuth } from './AuthContext';

const StudioContext = createContext(null);

export function StudioProvider({ children }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [presets, setPresets] = useState([]);
  const [guestPresets, setGuestPresets] = useState([]);
  const [voices, setVoices] = useState({
    cartoon_anime_rvc: [],
    human_actor_zero_shot: [],
    dsp_presets: [],
    fallback: true,
  });
  const [health, setHealth] = useState({
    filmyAi: { online: false },
    sounzAi: { online: false },
    gemini: { configured: false },
    checking: false,
  });

  const loadPresets = useCallback(async () => {
    try {
      const res = await apiFetch('/api/meetings/presets', {}, { skipAuth: true });
      setPresets(res?.data?.presets || []);
      setGuestPresets(res?.data?.guestPresets || []);
    } catch {
      // ignore preset failure before server starts
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    if (!isAuthenticated) return;
    setHealth((prev) => ({ ...prev, checking: true }));
    try {
      const res = await apiFetch('/api/studio/health');
      setHealth({ ...res.data, checking: false });
    } catch {
      setHealth((prev) => ({ ...prev, checking: false }));
    }
  }, [isAuthenticated]);

  const loadVoices = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch('/api/studio/voices');
      if (res?.data) setVoices(res.data);
    } catch {
      // keep existing voices
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      refreshHealth();
      loadVoices();
    }
  }, [authLoading, isAuthenticated, refreshHealth, loadVoices]);

  return (
    <StudioContext.Provider
      value={{
        presets,
        guestPresets,
        voices,
        health,
        refreshHealth,
        loadVoices,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used inside StudioProvider');
  return ctx;
}
