/**
 * ChatArchive - Componente Notificación y Banner de "Nueva Versión Disponible"
 * Detección automática de actualizaciones del Service Worker con botón "Actualizar ahora"
 */

import { showToast } from '../utils/helpers.js';

export class UpdateBannerManager {
  constructor() {
    this.registration = null;
    this.waitingWorker = null;
    this.bannerEl = null;
    this.isReloading = false;
    this.isChecking = false;
  }

  /**
   * Inicializa la escucha de actualizaciones del Service Worker
   * @param {ServiceWorkerRegistration} registration 
   */
  init(registration) {
    if (!registration) return;
    this.registration = registration;

    // 1. Si ya hay un Service Worker en estado 'waiting', mostrar aviso de inmediato
    if (registration.waiting) {
      this.waitingWorker = registration.waiting;
      this.show(this.waitingWorker);
    }

    // 2. Escuchar cuando se descubre un nuevo Service Worker en segundo plano
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        // Solo si pasa a 'installed' y ya existe un controlador previo (no es primera instalación)
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[ChatArchive Update] Nueva versión descargada y lista para activarse');
          this.waitingWorker = newWorker;
          this.show(newWorker);
        }
      });
    });

    // 3. Cuando el nuevo SW toma el control tras skipWaiting(), recargar suavemente la aplicación
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log('[ChatArchive Update] Nuevo controlador activo. Recargando página...');
      window.location.reload();
    });

    // 4. Comprobación al volver a enfocar la pestaña / app
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkForUpdates(false);
      }
    });

    // 5. Comprobación periódica cada 30 minutos
    setInterval(() => {
      this.checkForUpdates(false);
    }, 30 * 60 * 1000);
  }

  /**
   * Construye o recupera el elemento DOM del banner flotante
   */
  ensureDOM() {
    if (this.bannerEl) return this.bannerEl;

    let el = document.getElementById('caAppUpdateBanner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'caAppUpdateBanner';
      el.className = 'ca-update-banner ca-update-banner-hidden';
      el.setAttribute('role', 'alert');
      el.setAttribute('aria-live', 'polite');

      el.innerHTML = `
        <div class="d-flex align-items-start gap-3">
          <div class="ca-update-icon-box flex-shrink-0" aria-hidden="true">
            <i class="bi bi-arrow-clockwise"></i>
          </div>
          <div class="flex-grow-1 min-w-0">
            <div class="d-flex align-items-center justify-content-between mb-1">
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-success text-white rounded-pill px-2 py-0 small" style="font-size: 0.72rem;">Actualización</span>
                <h3 class="h6 fw-bold mb-0 text-ca-main">Nueva versión disponible</h3>
              </div>
              <button type="button" class="btn-close btn-sm" id="btnDismissUpdateBanner" aria-label="Cerrar aviso"></button>
            </div>
            <p class="text-ca-muted small mb-3" style="font-size: 0.835rem; line-height: 1.45;">
              Hay una actualización lista con mejoras y novedades para ChatArchive.
            </p>
            <div class="d-flex align-items-center gap-2">
              <button type="button" class="btn btn-ca-primary btn-sm px-3" id="btnApplyUpdateNow">
                <i class="bi bi-arrow-repeat me-1" aria-hidden="true"></i> Actualizar ahora
              </button>
              <button type="button" class="btn btn-outline-secondary btn-sm px-2" id="btnLaterUpdateBanner">
                Más tarde
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(el);

      // Listeners del banner
      const btnApply = el.querySelector('#btnApplyUpdateNow');
      const btnLater = el.querySelector('#btnLaterUpdateBanner');
      const btnClose = el.querySelector('#btnDismissUpdateBanner');

      if (btnApply) {
        btnApply.addEventListener('click', () => this.applyUpdate());
      }
      if (btnLater) {
        btnLater.addEventListener('click', () => this.hide());
      }
      if (btnClose) {
        btnClose.addEventListener('click', () => this.hide());
      }
    }

    this.bannerEl = el;
    return this.bannerEl;
  }

  /**
   * Muestra el banner flotante con animación suave
   * @param {ServiceWorker} worker 
   */
  show(worker) {
    if (worker) this.waitingWorker = worker;
    const el = this.ensureDOM();
    if (!el) return;

    // Resetear estado del botón en caso de reapertura
    const btnApply = el.querySelector('#btnApplyUpdateNow');
    if (btnApply) {
      btnApply.disabled = false;
      btnApply.innerHTML = '<i class="bi bi-arrow-repeat me-1" aria-hidden="true"></i> Actualizar ahora';
    }

    requestAnimationFrame(() => {
      el.classList.remove('ca-update-banner-hidden');
      el.classList.add('ca-update-banner-visible');
    });
  }

  /**
   * Oculta el banner
   */
  hide() {
    if (!this.bannerEl) return;
    this.bannerEl.classList.remove('ca-update-banner-visible');
    this.bannerEl.classList.add('ca-update-banner-hidden');
  }

  /**
   * Activa el nuevo Service Worker y recarga la aplicación
   */
  applyUpdate() {
    const el = this.ensureDOM();
    const btnApply = el ? el.querySelector('#btnApplyUpdateNow') : null;
    if (btnApply) {
      btnApply.disabled = true;
      btnApply.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Actualizando...';
    }

    if (this.waitingWorker) {
      console.log('[ChatArchive Update] Enviando mensaje SKIP_WAITING al worker en espera...');
      this.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Fallback: recarga directa
      window.location.reload();
      return;
    }

    // Fallback de seguridad si controllerchange tarda más de 2500ms
    setTimeout(() => {
      window.location.reload();
    }, 2500);
  }

  /**
   * Fuerza la búsqueda manual o automática de actualizaciones
   * @param {boolean} isManual Si es invocado por el usuario desde Ajustes
   */
  async checkForUpdates(isManual = false) {
    if (!('serviceWorker' in navigator) || !this.registration) {
      if (isManual) {
        showToast('Sin Soporte', 'El Service Worker no está disponible en este navegador.', 'warning');
      }
      return;
    }

    if (this.isChecking) return;
    this.isChecking = true;

    try {
      if (isManual) {
        showToast('Buscando actualizaciones', 'Comprobando si hay una versión más reciente...', 'info', 2000);
      }

      await this.registration.update();

      // Si después del update hay un worker esperando
      if (this.registration.waiting) {
        this.waitingWorker = this.registration.waiting;
        this.show(this.waitingWorker);
      } else if (isManual) {
        // Si no se encontró actualización nueva
        setTimeout(() => {
          if (!this.registration.waiting && !this.registration.installing) {
            showToast('Aplicación al día', 'Ya tienes instalada la versión más reciente de ChatArchive.', 'success');
          }
        }, 1200);
      }
    } catch (err) {
      console.warn('[ChatArchive Update] Error al comprobar actualización:', err);
      if (isManual) {
        showToast('Error', 'No se pudo verificar la actualización. Revisa tu conexión.', 'danger');
      }
    } finally {
      this.isChecking = false;
    }
  }
}

export const updateBannerManager = new UpdateBannerManager();
