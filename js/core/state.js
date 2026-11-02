/**
 * ChatArchive - Gestor de Estado Global de la Aplicación
 */

import { CONFIG } from './config.js';

class AppState {
  constructor() {
    this.currentRoute = CONFIG.ROUTES.DASHBOARD;
    this.currentChatId = null;
    this.theme = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) || CONFIG.THEMES.AUTO;
    this.viewMode = localStorage.getItem(CONFIG.STORAGE_KEYS.VIEW_MODE) || 'grid'; // grid | list
    this.isOnline = navigator.onLine;
    this.storageEstimate = { usage: 0, quota: 0, percent: 0 };
    this.stats = {
      totalConversations: 0,
      totalMessages: 0,
      totalMediaFiles: 0,
      totalStorageBytes: 0
    };
    this.listeners = new Set();
  }

  setTheme(theme) {
    if (Object.values(CONFIG.THEMES).includes(theme)) {
      this.theme = theme;
      localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, theme);
      this.applyTheme();
      this.notify();
    }
  }

  applyTheme() {
    const isDark = this.theme === CONFIG.THEMES.DARK || 
      (this.theme === CONFIG.THEMES.AUTO && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    document.documentElement.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');
    
    // Actualizar meta theme-color para navegadores móviles
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', isDark ? '#0b141a' : '#ffffff');
    }
  }

  setViewMode(mode) {
    if (mode === 'grid' || mode === 'list') {
      this.viewMode = mode;
      localStorage.setItem(CONFIG.STORAGE_KEYS.VIEW_MODE, mode);
      this.notify();
    }
  }

  setRoute(route, chatId = null) {
    this.currentRoute = route;
    this.currentChatId = chatId;
    this.notify();
  }

  async updateStorageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const percent = quota > 0 ? ((usage / quota) * 100).toFixed(2) : 0;
        this.storageEstimate = { usage, quota, percent };
        this.notify();
      } catch (err) {
        console.warn('[ChatArchive] No se pudo estimar el almacenamiento:', err);
      }
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this);
      } catch (e) {
        console.error('[ChatArchive] Error en subscriber de estado:', e);
      }
    }
  }
}

export const state = new AppState();
