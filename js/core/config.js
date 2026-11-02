/**
 * ChatArchive - Configuración Global
 * Compatible con GitHub Pages (sin rutas absolutas al dominio raíz)
 */

export const CONFIG = {
  APP_NAME: 'ChatArchive',
  APP_VERSION: '1.0.0',
  APP_TAGLINE: 'Tu archivo personal, privado y seguro de conversaciones de WhatsApp',
  
  // Almacenamiento
  DB_NAME: 'ChatArchiveDB',
  DB_VERSION: 1,

  // Claves de LocalStorage (Solo preferencias)
  STORAGE_KEYS: {
    THEME: 'chatarchive_theme',
    VIEW_MODE: 'chatarchive_view_mode',
    FONT_SIZE: 'chatarchive_font_size',
    CHAT_DENSITY: 'chatarchive_chat_density'
  },

  // Temas soportados
  THEMES: {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
  },

  // Rutas de navegación hash (para GitHub Pages)
  ROUTES: {
    DASHBOARD: 'dashboard',
    LIBRARY: 'library',
    IMPORT: 'import',
    CHAT: 'chat',
    SETTINGS: 'settings'
  }
};
