/**
 * ChatArchive - Banner Automático de Instalación PWA (Progressive Web App)
 * Manejo de beforeinstallprompt, frecuencia de 7 días, detección standalone, soporte iOS Safari y coordinación con tutorial.
 */

import { showToast } from '../utils/helpers.js';

const STORAGE_KEYS = {
  INSTALLED: 'chatarchive_app_installed',
  DISMISSED_AT: 'chatarchive_install_dismissed_at',
  REJECTED_AT: 'chatarchive_install_rejected_at'
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class PwaInstallBannerManager {
  constructor() {
    this.deferredPrompt = null;
    this.bannerEl = null;
    this.iosModalEl = null;
    this.isTutorialActive = false;
    this.delayTimer = null;
    this.init();
  }

  init() {
    // 0. Escuchar ciclo de vida del tutorial para garantizar secuencia estricta
    window.addEventListener('tutorial:opened', () => {
      this.setTutorialActive(true);
    });

    window.addEventListener('tutorial:closed', () => {
      this.setTutorialActive(false);
      this.scheduleBanner(5000);
    });

    // 1. Escuchar evento beforeinstallprompt nativo del navegador
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevenir el infobar por defecto del navegador para usar nuestro banner personalizado
      e.preventDefault();
      this.deferredPrompt = e;
      console.log('[ChatArchive PWA] Evento beforeinstallprompt capturado y listo');

      // También coordinar con el botón de instalación del navbar si existe
      const btnNavbar = document.getElementById('btnInstallPwa');
      if (btnNavbar) {
        btnNavbar.classList.remove('d-none');
        btnNavbar.classList.add('d-inline-flex');
        btnNavbar.addEventListener('click', () => this.triggerInstall(), { once: true });
      }
    });

    // 2. Escuchar evento appinstalled al completarse exitosamente la instalación
    window.addEventListener('appinstalled', () => {
      console.log('[ChatArchive PWA] Evento appinstalled confirmado por el sistema');
      localStorage.setItem(STORAGE_KEYS.INSTALLED, 'true');
      this.hideBanner();

      const btnNavbar = document.getElementById('btnInstallPwa');
      if (btnNavbar) {
        btnNavbar.classList.add('d-none');
        btnNavbar.classList.remove('d-inline-flex');
      }

      showToast('¡Instalación Exitosa!', 'ChatArchive se ha instalado correctamente en tu pantalla principal.', 'success');
    });
  }

  /**
   * Comprueba si la aplicación ya se está ejecutando instalada en modo standalone
   * @returns {boolean}
   */
  isStandalone() {
    const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
    const isNavigatorStandalone = window.navigator.standalone === true; // iOS Safari
    const isMarkedInstalled = localStorage.getItem(STORAGE_KEYS.INSTALLED) === 'true';

    return isStandaloneDisplay || isNavigatorStandalone || isMarkedInstalled;
  }

  /**
   * Comprueba si el dispositivo actual es iOS con Safari
   * @returns {boolean}
   */
  isIosSafari() {
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);
    return isIos && isSafari;
  }

  /**
   * Verifica si las reglas de frecuencia permiten mostrar el banner
   * @returns {boolean}
   */
  canShowBanner() {
    // Si ya está instalada, nunca mostrar
    if (this.isStandalone()) {
      return false;
    }

    // Comprobar descarte reciente (7 días)
    const dismissedAt = localStorage.getItem(STORAGE_KEYS.DISMISSED_AT);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < SEVEN_DAYS_MS) {
        return false;
      }
    }

    // Comprobar rechazo reciente en diálogo nativo (7 días)
    const rejectedAt = localStorage.getItem(STORAGE_KEYS.REJECTED_AT);
    if (rejectedAt) {
      const elapsed = Date.now() - parseInt(rejectedAt, 10);
      if (elapsed < SEVEN_DAYS_MS) {
        return false;
      }
    }

    // Debe ser instalable: o tenemos deferredPrompt (Chrome/Edge/Android) o es iOS Safari
    return Boolean(this.deferredPrompt || this.isIosSafari());
  }

  /**
   * Programa la comprobación y aparición del banner respetando los 5 segundos de espera
   * @param {number} delayMs Tiempo de espera en milisegundos (por defecto 5000 ms)
   */
  scheduleBanner(delayMs = 5000) {
    if (this.delayTimer) {
      clearTimeout(this.delayTimer);
    }

    this.delayTimer = setTimeout(() => {
      // Revalidar que el tutorial no esté abierto
      if (this.isTutorialActive) {
        return;
      }

      if (this.canShowBanner()) {
        this.renderAndShowBanner();
      }
    }, delayMs);
  }

  /**
   * Notifica el estado del tutorial para evitar superposiciones
   * @param {boolean} active
   */
  setTutorialActive(active) {
    this.isTutorialActive = active;
    if (active) {
      this.hideBanner();
      if (this.delayTimer) {
        clearTimeout(this.delayTimer);
        this.delayTimer = null;
      }
    }
  }

  /**
   * Construye e inserta el banner en el DOM
   */
  renderAndShowBanner() {
    if (document.getElementById('caPwaInstallBanner')) {
      const banner = document.getElementById('caPwaInstallBanner');
      banner.classList.remove('ca-pwa-banner-hidden');
      banner.classList.add('ca-pwa-banner-visible');
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'caPwaInstallBanner';
    banner.className = 'ca-pwa-banner ca-pwa-banner-hidden';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Instalación de la aplicación');

    banner.innerHTML = `
      <div class="d-flex align-items-start gap-3">
        <div class="ca-pwa-icon-box">
          <i class="bi bi-cloud-arrow-down-fill" aria-hidden="true"></i>
        </div>
        <div class="flex-grow-1 min-w-0">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <h4 class="h6 fw-bold mb-0 text-ca-main">Instala ChatArchive</h4>
            <button 
              type="button" 
              class="btn btn-sm btn-outline-secondary btn-icon-only border-0" 
              id="btnDismissPwaBanner" 
              title="Cerrar invitación" 
              aria-label="Cerrar invitación de instalación"
            >
              <i class="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </div>
          <p class="text-ca-muted small mb-3" style="font-size: 0.825rem; line-height: 1.4;">
            Accede a tus conversaciones de forma más rápida y cómoda. Instala la aplicación para tenerla siempre a mano y utilizarla incluso sin conexión.
          </p>
          <div class="d-flex align-items-center gap-2">
            <button type="button" class="btn btn-ca-primary btn-sm px-3 shadow-sm" id="btnActionInstallPwa">
              <i class="bi bi-download me-1" aria-hidden="true"></i> Instalar aplicación
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm" id="btnDismissPwaBannerText">
              Quizás más tarde
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(banner);
    this.bannerEl = banner;

    // Vincular eventos
    banner.querySelector('#btnActionInstallPwa')?.addEventListener('click', () => {
      this.triggerInstall();
    });

    banner.querySelector('#btnDismissPwaBanner')?.addEventListener('click', () => {
      this.dismissBanner();
    });

    banner.querySelector('#btnDismissPwaBannerText')?.addEventListener('click', () => {
      this.dismissBanner();
    });

    // Animación de entrada fluida
    requestAnimationFrame(() => {
      banner.classList.remove('ca-pwa-banner-hidden');
      banner.classList.add('ca-pwa-banner-visible');
    });
  }

  /**
   * Ejecuta el flujo de instalación según el navegador y plataforma
   */
  async triggerInstall() {
    if (this.deferredPrompt) {
      try {
        this.deferredPrompt.prompt();
        const choice = await this.deferredPrompt.userChoice;
        console.log(`[ChatArchive PWA] Elección de instalación del usuario: ${choice.outcome}`);

        if (choice.outcome === 'accepted') {
          // Aceptada: esperar confirmación del evento appinstalled
          this.hideBanner();
        } else {
          // Rechazada: registrar timestamp de rechazo para respetar los 7 días
          localStorage.setItem(STORAGE_KEYS.REJECTED_AT, Date.now().toString());
          this.hideBanner();
        }

        this.deferredPrompt = null;
      } catch (err) {
        console.error('[ChatArchive PWA] Error al disparar prompt de instalación:', err);
      }
    } else if (this.isIosSafari()) {
      // Mostrar instrucciones personalizadas para iOS Safari
      this.showIosInstructions();
    } else {
      // Navegadores sin soporte de instalación directa
      showToast('Instalación en tu navegador', 'Para instalar ChatArchive, utiliza la opción "Instalar aplicación" o "Añadir a pantalla de inicio" desde el menú de tu navegador.', 'info');
      this.hideBanner();
    }
  }

  /**
   * Cierra el banner por decisión del usuario y guarda la fecha para respetar los 7 días
   */
  dismissBanner() {
    localStorage.setItem(STORAGE_KEYS.DISMISSED_AT, Date.now().toString());
    this.hideBanner();
  }

  /**
   * Oculta el banner visualmente con animación
   */
  hideBanner() {
    const banner = document.getElementById('caPwaInstallBanner');
    if (banner) {
      banner.classList.remove('ca-pwa-banner-visible');
      banner.classList.add('ca-pwa-banner-hidden');
      setTimeout(() => {
        banner.remove();
        this.bannerEl = null;
      }, 400);
    }
  }

  /**
   * Despliega modal de instrucciones para usuarios en iOS / Safari
   */
  showIosInstructions() {
    let modalEl = document.getElementById('iosInstallModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'iosInstallModal';
      modalEl.className = 'modal fade ca-ios-install-modal';
      modalEl.setAttribute('tabindex', '-1');
      modalEl.setAttribute('aria-labelledby', 'iosInstallModalLabel');
      modalEl.setAttribute('aria-hidden', 'true');

      modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-ca shadow-lg">
            <div class="modal-header border-ca">
              <h5 class="modal-title fw-bold d-flex align-items-center gap-2" id="iosInstallModalLabel">
                <i class="bi bi-apple text-primary" aria-hidden="true"></i>
                <span>Instalar en iPhone o iPad</span>
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body p-4">
              <p class="text-ca-muted small mb-3">
                Safari en iOS requiere que agregues la aplicación manualmente siguiendo estos 3 pasos:
              </p>
              <div class="ca-ios-step-row">
                <span class="badge bg-primary rounded-circle p-2 fs-6">1</span>
                <div class="small">
                  Toca el botón <strong>Compartir</strong> en la barra inferior de Safari:
                  <div class="mt-1 text-primary fw-bold"><i class="bi bi-box-arrow-up fs-5 me-1"></i> Compartir</div>
                </div>
              </div>
              <div class="ca-ios-step-row">
                <span class="badge bg-primary rounded-circle p-2 fs-6">2</span>
                <div class="small">
                  Desplázate por el menú y selecciona:
                  <div class="mt-1 text-primary fw-bold"><i class="bi bi-plus-square fs-5 me-1"></i> Añadir a pantalla de inicio</div>
                </div>
              </div>
              <div class="ca-ios-step-row">
                <span class="badge bg-primary rounded-circle p-2 fs-6">3</span>
                <div class="small">
                  Toca <strong>Añadir</strong> en la esquina superior derecha para finalizar.
                </div>
              </div>
            </div>
            <div class="modal-footer border-ca">
              <button type="button" class="btn btn-ca-primary btn-sm px-4" data-bs-dismiss="modal">Entendido</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modalEl);
    }

    if (window.bootstrap && window.bootstrap.Modal) {
      new window.bootstrap.Modal(modalEl).show();
    }
  }
}

// Instancia única exportada
export const pwaInstallBannerManager = new PwaInstallBannerManager();
