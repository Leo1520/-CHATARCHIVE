/**
 * ChatArchive - Enrutador del Cliente
 * Basado en Hash para compatibilidad total con GitHub Pages
 */

import { CONFIG } from './config.js';
import { state } from './state.js';
import { renderDashboard } from '../views/dashboard.js';
import { renderLibrary } from '../views/library.js';
import { renderImporterView } from '../import/importer.js';
import { renderSettings } from '../views/settings.js';
import { renderChatViewer } from '../views/chat-viewer.js';

export class Router {
  constructor() {
    this.routes = {
      [CONFIG.ROUTES.DASHBOARD]: renderDashboard,
      [CONFIG.ROUTES.LIBRARY]: renderLibrary,
      [CONFIG.ROUTES.IMPORT]: renderImporterView,
      [CONFIG.ROUTES.CHAT]: renderChatViewer,
      [CONFIG.ROUTES.SETTINGS]: renderSettings
    };

    window.addEventListener('hashchange', () => this.handleRoute());
  }

  init() {
    this.handleRoute();
  }

  navigate(route, params = null) {
    if (params) {
      window.location.hash = `#${route}?${new URLSearchParams(params).toString()}`;
    } else {
      window.location.hash = `#${route}`;
    }
  }

  handleRoute() {
    const rawHash = window.location.hash.slice(1) || CONFIG.ROUTES.DASHBOARD;
    const [path, queryString] = rawHash.split('?');
    const params = new URLSearchParams(queryString || '');
    
    const targetRoute = this.routes[path] ? path : CONFIG.ROUTES.DASHBOARD;
    state.setRoute(targetRoute, params.get('id'));

    // Actualizar enlaces de navegación activos
    this.updateActiveNavLinks(targetRoute);

    // Renderizar vista
    const mainContainer = document.getElementById('mainContent');
    if (mainContainer) {
      mainContainer.innerHTML = '';
      const renderFn = this.routes[targetRoute] || this.routes[CONFIG.ROUTES.DASHBOARD];
      renderFn(mainContainer, params);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  updateActiveNavLinks(currentRoute) {
    const routeIndexMap = {
      dashboard: 0,
      library: 1,
      chat: 1, // En el visor de chat la biblioteca permanece como origen activo
      import: 2,
      settings: 3
    };

    const bottomNav = document.getElementById('mobileBottomNav');
    if (bottomNav && routeIndexMap[currentRoute] !== undefined) {
      bottomNav.style.setProperty('--active-idx', routeIndexMap[currentRoute]);
    }

    document.querySelectorAll('[data-route]').forEach(link => {
      const linkRoute = link.getAttribute('data-route');
      if (linkRoute === currentRoute || (currentRoute === 'chat' && linkRoute === 'library')) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });
  }
}

export const router = new Router();
