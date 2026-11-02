/**
 * ChatArchive - Punto de Entrada Principal (Main Application)
 * Inicialización de componentes, Service Worker y PWA
 */

import { state } from './core/state.js';
import { CONFIG } from './core/config.js';
import { router } from './core/router.js';
import { showToast } from './utils/helpers.js';
import { ConversationsRepository } from './database/conversations.js';

class App {
  constructor() {
    this.init();
  }

  async init() {
    console.log(`[ChatArchive] Inicializando versión ${CONFIG.APP_VERSION}...`);

    // 1. Aplicar tema inicial (claro, oscuro o sistema)
    state.applyTheme();

    // 2. Escuchar cambios de preferencia del sistema si el tema es "auto"
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (state.theme === CONFIG.THEMES.AUTO) {
        state.applyTheme();
      }
    });

    // 3. Configurar listeners de interfaz fija (Navbar, Theme Toggle, Online status)
    this.setupNavbarListeners();
    this.setupConnectivityListeners();

    // 4. Cargar estadísticas de IndexedDB y actualizar almacenamiento local
    try {
      const globalStats = await ConversationsRepository.getGlobalStats();
      state.stats.totalConversations = globalStats.totalConversations;
      state.stats.totalMessages = globalStats.totalMessages;
      state.stats.totalMediaFiles = globalStats.totalMedia;
    } catch (e) {
      console.warn('[ChatArchive] IndexedDB aún no inicializado o vacío:', e);
    }
    await state.updateStorageEstimate();

    // 5. Inicializar el enrutador cliente
    router.init();

    // 6. Registrar Service Worker para soporte PWA y modo Offline
    this.registerServiceWorker();

    // 7. Inicializar Tooltips de Bootstrap
    this.initTooltips();
  }

  setupNavbarListeners() {
    // Botón de alternancia rápida de tema (Navbar)
    const btnToggleTheme = document.getElementById('btnToggleTheme');
    if (btnToggleTheme) {
      btnToggleTheme.addEventListener('click', () => {
        const nextTheme = state.theme === CONFIG.THEMES.DARK ? CONFIG.THEMES.LIGHT : CONFIG.THEMES.DARK;
        state.setTheme(nextTheme);
        this.updateThemeToggleIcon();
      });
      this.updateThemeToggleIcon();
    }
  }

  updateThemeToggleIcon() {
    const icon = document.querySelector('#btnToggleTheme i');
    if (!icon) return;

    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    if (isDark) {
      icon.className = 'bi bi-sun-fill text-warning';
      icon.parentElement.setAttribute('title', 'Cambiar a modo claro');
      icon.parentElement.setAttribute('aria-label', 'Cambiar a modo claro');
    } else {
      icon.className = 'bi bi-moon-stars-fill text-secondary';
      icon.parentElement.setAttribute('title', 'Cambiar a modo oscuro');
      icon.parentElement.setAttribute('aria-label', 'Cambiar a modo oscuro');
    }
  }

  setupConnectivityListeners() {
    const updateStatus = () => {
      const isOnline = navigator.onLine;
      state.isOnline = isOnline;
      const badge = document.getElementById('networkStatusBadge');
      if (badge) {
        if (isOnline) {
          badge.className = 'badge ca-badge-soft-success d-none d-sm-inline-flex align-items-center gap-1';
          badge.innerHTML = '<i class="bi bi-wifi" aria-hidden="true"></i> Conectado';
        } else {
          badge.className = 'badge ca-badge-soft-info d-none d-sm-inline-flex align-items-center gap-1';
          badge.innerHTML = '<i class="bi bi-hdd-network" aria-hidden="true"></i> Modo Offline';
          showToast('Modo Offline', 'Estás navegando sin conexión. Todas tus conversaciones siguen accesibles localmente.', 'info');
        }
      }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        // Usar ruta relativa para compatibilidad con subdirectorios en GitHub Pages
        const registration = await navigator.serviceWorker.register('./sw.js', {
          scope: './'
        });
        console.log('[ChatArchive PWA] Service Worker registrado exitosamente:', registration.scope);
      } catch (err) {
        console.warn('[ChatArchive PWA] Error al registrar Service Worker:', err);
      }
    }
  }

  initTooltips() {
    if (window.bootstrap && window.bootstrap.Tooltip) {
      const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
      [...tooltipTriggerList].map(tooltipTriggerEl => new window.bootstrap.Tooltip(tooltipTriggerEl));
    }
  }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.chatArchiveApp = new App();
});
