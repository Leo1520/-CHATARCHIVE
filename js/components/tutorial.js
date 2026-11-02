/**
 * ChatArchive - Componente del Tutorial Interactivo de Bienvenida (Onboarding)
 * 6 pasos interactivos, barra de progreso, persistencia en localStorage y reapertura desde Ajustes.
 */

const STORAGE_KEYS = {
  COMPLETED: 'chatarchive_tutorial_completed',
  SKIPPED: 'chatarchive_tutorial_skipped'
};

export class TutorialManager {
  constructor() {
    this.currentStep = 0; // 0 = Bienvenida, 1..6 = Pasos, 7 = Pantalla final
    this.totalSteps = 6;
    this.modal = null;
    this.modalEl = null;
    this._isOpen = false;
    this.closeCallbacks = [];
  }

  /**
   * Comprueba si el tutorial ya fue completado u omitido previamente
   * @returns {boolean}
   */
  isCompletedOrSkipped() {
    return (
      localStorage.getItem(STORAGE_KEYS.COMPLETED) === 'true' ||
      localStorage.getItem(STORAGE_KEYS.SKIPPED) === 'true'
    );
  }

  /**
   * Indica si el tutorial se encuentra actualmente visible en pantalla
   * @returns {boolean}
   */
  isOpen() {
    return this._isOpen;
  }

  /**
   * Registra un callback que se ejecuta al cerrarse el tutorial (completado u omitido)
   * @param {Function} callback (reason: 'completed' | 'skipped') => void
   */
  onClose(callback) {
    if (typeof callback === 'function') {
      this.closeCallbacks.push(callback);
    }
  }

  /**
   * Abre el tutorial interactivo
   * @param {boolean} force Si es true, ignora el estado de localStorage (ej. lanzado desde Ajustes)
   */
  show(force = false) {
    if (!force && this.isCompletedOrSkipped()) {
      return;
    }

    this.currentStep = 0;
    this.ensureModalDOM();
    this.renderCurrentStep();

    if (window.bootstrap && window.bootstrap.Modal) {
      this.modal = new window.bootstrap.Modal(this.modalEl, {
        backdrop: 'static',
        keyboard: false
      });
      this.modal.show();
      this._isOpen = true;
      window.dispatchEvent(new CustomEvent('tutorial:opened'));
    }
  }

  /**
   * Crea o localiza el contenedor del modal en el DOM
   */
  ensureModalDOM() {
    let el = document.getElementById('welcomeTutorialModal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'welcomeTutorialModal';
      el.className = 'modal fade ca-tutorial-modal';
      el.setAttribute('tabindex', '-1');
      el.setAttribute('aria-labelledby', 'tutorialModalTitle');
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('role', 'dialog');

      el.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content shadow-lg border-ca">
            <!-- Cabecera Dinámica -->
            <div class="modal-header d-flex flex-column align-items-stretch">
              <div class="d-flex align-items-center justify-content-between w-100">
                <div class="d-flex align-items-center gap-2">
                  <img src="./assets/logo/logo.svg" alt="ChatArchive" width="28" height="28" class="rounded">
                  <span class="fw-bold fs-6 text-ca-main" id="tutorialBrandText">ChatArchive</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <span class="badge ca-badge-soft-success small" id="tutorialStepBadge" style="display: none;">Paso 1 de 6</span>
                  <button type="button" class="btn btn-sm btn-outline-secondary btn-icon-only border-0" id="btnTutorialSkipCross" title="Omitir tutorial" aria-label="Omitir tutorial">
                    <i class="bi bi-x-lg" aria-hidden="true"></i>
                  </button>
                </div>
              </div>
              <div class="ca-tutorial-progress-container" id="tutorialProgressWrapper" style="display: none;">
                <div class="ca-tutorial-progress-bar">
                  <div class="ca-tutorial-progress-fill" id="tutorialProgressFill" style="width: 16.6%;"></div>
                </div>
              </div>
            </div>

            <!-- Cuerpo Dinámico del Paso -->
            <div class="modal-body" id="tutorialStepBody"></div>

            <!-- Pie con Controles de Navegación -->
            <div class="modal-footer d-flex justify-content-between align-items-center" id="tutorialFooterControls"></div>
          </div>
        </div>
      `;

      document.body.appendChild(el);

      // Evento de cierre nativo
      el.querySelector('#btnTutorialSkipCross')?.addEventListener('click', () => {
        this.skipTutorial();
      });
    }

    this.modalEl = el;
  }

  /**
   * Renderiza el contenido correspondiente al paso activo
   */
  renderCurrentStep() {
    const stepBody = this.modalEl.querySelector('#tutorialStepBody');
    const footer = this.modalEl.querySelector('#tutorialFooterControls');
    const stepBadge = this.modalEl.querySelector('#tutorialStepBadge');
    const progressWrapper = this.modalEl.querySelector('#tutorialProgressWrapper');
    const progressFill = this.modalEl.querySelector('#tutorialProgressFill');

    if (!stepBody || !footer) return;

    // Actualizar barra de progreso y badges
    if (this.currentStep >= 1 && this.currentStep <= this.totalSteps) {
      stepBadge.style.display = 'inline-flex';
      stepBadge.textContent = `Paso ${this.currentStep} de ${this.totalSteps}`;
      progressWrapper.style.display = 'block';
      const percent = Math.round((this.currentStep / this.totalSteps) * 100);
      progressFill.style.width = `${percent}%`;
    } else {
      stepBadge.style.display = 'none';
      progressWrapper.style.display = 'none';
    }

    // Contenido según paso
    let bodyHtml = '';
    let footerHtml = '';

    switch (this.currentStep) {
      case 0:
        // Pantalla de Bienvenida
        bodyHtml = `
          <div class="ca-tutorial-step text-center py-3">
            <div class="mb-3">
              <div class="d-inline-flex p-3 rounded-4 bg-success-subtle text-success mb-2 shadow-sm">
                <i class="bi bi-chat-heart fs-1" aria-hidden="true"></i>
              </div>
              <h1 class="h3 fw-bold text-ca-main mt-2 mb-2" id="tutorialModalTitle">¡Bienvenido a ChatArchive!</h1>
              <p class="lead text-ca-muted fs-6 mx-auto mb-3" style="max-width: 540px;">
                Tu espacio personal para importar, organizar y consultar tus conversaciones de WhatsApp.
              </p>
            </div>

            <div class="ca-tutorial-visual-card text-start mx-auto p-3" style="max-width: 540px;">
              <div class="d-flex align-items-center gap-3 mb-2">
                <i class="bi bi-shield-lock-fill text-success fs-3" aria-hidden="true"></i>
                <div>
                  <strong class="d-block text-ca-main small">100% Privado en tu Dispositivo</strong>
                  <span class="text-ca-muted small">Tus conversaciones permanecen almacenadas localmente, con privacidad total y acceso incluso sin conexión.</span>
                </div>
              </div>
            </div>
          </div>
        `;

        footerHtml = `
          <button type="button" class="btn btn-outline-secondary btn-sm" id="btnTutorialSkipWelcome">
            <i class="bi bi-x-circle me-1" aria-hidden="true"></i> Omitir
          </button>
          <button type="button" class="btn btn-ca-primary btn-sm px-4" id="btnTutorialStart">
            <span>Comenzar tutorial</span>
            <i class="bi bi-arrow-right ms-1" aria-hidden="true"></i>
          </button>
        `;
        break;

      case 1:
        // Paso 1: Tu biblioteca
        bodyHtml = `
          <div class="ca-tutorial-step">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="ca-tutorial-step-badge">1</span>
              <span class="text-ca-muted small fw-semibold text-uppercase tracking-wider">Tu biblioteca</span>
            </div>
            <h2 class="h5 fw-bold text-ca-main mb-2">Todas tus conversaciones en un solo lugar</h2>
            <p class="text-ca-muted small mb-3">
              La biblioteca es el espacio donde se almacenan y organizan las conversaciones importadas. Puedes consultar rápidamente los mensajes, participantes y fechas sin depender de WhatsApp.
            </p>

            <div class="ca-tutorial-visual-card">
              <div class="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom border-ca small">
                <span class="fw-bold text-ca-main d-flex align-items-center gap-1">
                  <i class="bi bi-collection text-primary" aria-hidden="true"></i>
                  <span>Biblioteca de Chats</span>
                </span>
                <span class="badge ca-badge-soft-success">Acceso rápido</span>
              </div>
              <div class="p-2 rounded-3 bg-ca-surface border border-ca d-flex align-items-center gap-3">
                <div class="ca-chat-avatar flex-shrink-0" style="width: 44px; height: 44px; font-size: 1.25rem;">
                  <i class="bi bi-people" aria-hidden="true"></i>
                </div>
                <div class="flex-grow-1 min-w-0">
                  <div class="d-flex justify-content-between">
                    <strong class="small text-truncate">Viaje con Amigos</strong>
                    <small class="text-ca-muted">14:20</small>
                  </div>
                  <div class="small text-ca-muted text-truncate">¡Nos vemos en el aeropuerto! ✈️</div>
                  <small class="text-success fw-semibold"><i class="bi bi-chat-text me-1"></i> 1.240 mensajes</small>
                </div>
              </div>
              <small class="d-block text-ca-muted mt-2 text-center" style="font-size: 0.78rem;">
                <i class="bi bi-info-circle me-1 text-primary"></i> Encuentra la pestaña <strong>Biblioteca</strong> en la barra de navegación.
              </small>
            </div>
          </div>
        `;

        footerHtml = `
          <button type="button" class="btn btn-outline-secondary btn-sm" id="btnTutorialSkip">Omitir tutorial</button>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm" id="btnTutorialPrev">
              <i class="bi bi-chevron-left me-1" aria-hidden="true"></i> Anterior
            </button>
            <button type="button" class="btn btn-ca-primary btn-sm px-3" id="btnTutorialNext">
              Siguiente <i class="bi bi-chevron-right ms-1" aria-hidden="true"></i>
            </button>
          </div>
        `;
        break;

      case 2:
        // Paso 2: Importar conversaciones
        bodyHtml = `
          <div class="ca-tutorial-step">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="ca-tutorial-step-badge">2</span>
              <span class="text-ca-muted small fw-semibold text-uppercase tracking-wider">Importación</span>
            </div>
            <h2 class="h5 fw-bold text-ca-main mb-2">Importa tus conversaciones de WhatsApp</h2>
            <p class="text-ca-muted small mb-2">
              Exportar tu chat desde WhatsApp e importarlo en ChatArchive es muy sencillo:
            </p>

            <ol class="small text-ca-muted ps-3 mb-3 d-flex flex-column gap-1">
              <li>Abre <strong>WhatsApp</strong> en tu teléfono.</li>
              <li>Entra en la conversación que deseas respaldar.</li>
              <li>Toca el menú de opciones (tres puntos) y selecciona <strong>Más → Exportar chat</strong>.</li>
              <li>Elige si deseas <strong>Incluir multimedia</strong> (fotos, audios) o Solo texto.</li>
              <li>Sube el archivo <strong>ZIP o TXT</strong> en la pestaña <strong>Importar</strong> de ChatArchive.</li>
            </ol>

            <div class="ca-tutorial-visual-card text-center py-2">
              <div class="d-inline-flex p-2 rounded-3 bg-primary-subtle text-primary mb-1">
                <i class="bi bi-cloud-arrow-up fs-3" aria-hidden="true"></i>
              </div>
              <div class="small fw-semibold text-ca-main">Zona de Importación Segura</div>
              <p class="text-ca-muted small mb-0 px-2" style="font-size: 0.8rem;">
                Los archivos multimedia se procesan y almacenan en tu dispositivo. ¡Nunca viajan a internet!
              </p>
            </div>
          </div>
        `;

        footerHtml = `
          <button type="button" class="btn btn-outline-secondary btn-sm" id="btnTutorialSkip">Omitir tutorial</button>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm" id="btnTutorialPrev">
              <i class="bi bi-chevron-left me-1" aria-hidden="true"></i> Anterior
            </button>
            <button type="button" class="btn btn-ca-primary btn-sm px-3" id="btnTutorialNext">
              Siguiente <i class="bi bi-chevron-right ms-1" aria-hidden="true"></i>
            </button>
          </div>
        `;
        break;

      case 3:
        // Paso 3: Explorar conversaciones
        bodyHtml = `
          <div class="ca-tutorial-step">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="ca-tutorial-step-badge">3</span>
              <span class="text-ca-muted small fw-semibold text-uppercase tracking-wider">Visor de Chats</span>
            </div>
            <h2 class="h5 fw-bold text-ca-main mb-2">Revive y consulta tus conversaciones</h2>
            <p class="text-ca-muted small mb-3">
              Al abrir una conversación, el visor reproduce la estética original de WhatsApp. Identifica a cada participante con colores distintivos y conserva el orden cronológico fielmente.
            </p>

            <div class="ca-tutorial-visual-card">
              <div class="text-center mb-2">
                <span class="badge bg-secondary-subtle text-secondary small px-3 py-1 rounded-pill">12 DE OCTUBRE</span>
              </div>
              <div class="ca-mockup-chat">
                <div class="ca-mockup-bubble-in">
                  <div class="fw-bold small text-info" style="font-size: 0.75rem;">María</div>
                  <div>¿Ya tienes las entradas confirmadas?</div>
                  <div class="text-end text-ca-muted" style="font-size: 0.65rem;">10:14</div>
                </div>
                <div class="ca-mockup-bubble-out">
                  <div>¡Sí, listas! Te las acabo de enviar al correo.</div>
                  <div class="text-end text-white-50" style="font-size: 0.65rem;">10:15 <i class="bi bi-check2-all text-white"></i></div>
                </div>
              </div>
            </div>
          </div>
        `;

        footerHtml = `
          <button type="button" class="btn btn-outline-secondary btn-sm" id="btnTutorialSkip">Omitir tutorial</button>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm" id="btnTutorialPrev">
              <i class="bi bi-chevron-left me-1" aria-hidden="true"></i> Anterior
            </button>
            <button type="button" class="btn btn-ca-primary btn-sm px-3" id="btnTutorialNext">
              Siguiente <i class="bi bi-chevron-right ms-1" aria-hidden="true"></i>
            </button>
          </div>
        `;
        break;

      case 4:
        // Paso 4: Perspectiva de visualización
        bodyHtml = `
          <div class="ca-tutorial-step">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="ca-tutorial-step-badge">4</span>
              <span class="text-ca-muted small fw-semibold text-uppercase tracking-wider">Perspectiva</span>
            </div>
            <h2 class="h5 fw-bold text-ca-main mb-2">Mira las conversaciones desde diferentes perspectivas</h2>
            <p class="text-ca-muted small mb-2">
              Puedes alternar el punto de vista del chat en cualquier momento desde la barra superior:
            </p>

            <ul class="small text-ca-muted ps-3 mb-3 d-flex flex-column gap-1">
              <li><strong>Vista original:</strong> conserva la presentación original de la exportación diferenciando participantes.</li>
              <li><strong>Ver como emisor:</strong> muestra tus mensajes a la derecha y los de la otra persona a la izquierda.</li>
              <li><strong>Ver como receptor:</strong> invierte la perspectiva visual a la izquierda/derecha.</li>
            </ul>

            <div class="ca-tutorial-visual-card">
              <div class="ca-mockup-perspective-demo">
                <div class="ca-mockup-mode-pill">
                  <i class="bi bi-clock-history d-block mb-1 text-secondary" aria-hidden="true"></i>
                  <small>Original</small>
                </div>
                <div class="ca-mockup-mode-pill active">
                  <i class="bi bi-box-arrow-right d-block mb-1 text-primary" aria-hidden="true"></i>
                  <small>Emisor</small>
                </div>
                <div class="ca-mockup-mode-pill">
                  <i class="bi bi-box-arrow-in-left d-block mb-1 text-secondary" aria-hidden="true"></i>
                  <small>Receptor</small>
                </div>
              </div>
              <small class="d-block text-ca-muted mt-2 text-center" style="font-size: 0.78rem;">
                <i class="bi bi-check-circle text-success me-1"></i> No altera mensajes, fechas ni horas almacenadas.
              </small>
            </div>
          </div>
        `;

        footerHtml = `
          <button type="button" class="btn btn-outline-secondary btn-sm" id="btnTutorialSkip">Omitir tutorial</button>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm" id="btnTutorialPrev">
              <i class="bi bi-chevron-left me-1" aria-hidden="true"></i> Anterior
            </button>
            <button type="button" class="btn btn-ca-primary btn-sm px-3" id="btnTutorialNext">
              Siguiente <i class="bi bi-chevron-right ms-1" aria-hidden="true"></i>
            </button>
          </div>
        `;
        break;

      case 5:
        // Paso 5: Buscar mensajes
        bodyHtml = `
          <div class="ca-tutorial-step">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="ca-tutorial-step-badge">5</span>
              <span class="text-ca-muted small fw-semibold text-uppercase tracking-wider">Búsqueda Rápida</span>
            </div>
            <h2 class="h5 fw-bold text-ca-main mb-2">Encuentra cualquier mensaje rápidamente</h2>
            <p class="text-ca-muted small mb-3">
              Busca palabras clave, fechas o frases en conversaciones con miles de mensajes en cuestión de milisegundos con navegación entre coincidencias y resaltado visual.
            </p>

            <div class="ca-tutorial-visual-card">
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text bg-transparent border-ca"><i class="bi bi-search text-primary"></i></span>
                <input type="text" class="form-control bg-transparent border-ca" value="contraseña wifi" readonly>
                <span class="input-group-text bg-secondary-subtle border-ca small">1 de 3</span>
                <button class="btn btn-outline-secondary btn-sm" type="button"><i class="bi bi-chevron-up"></i></button>
                <button class="btn btn-outline-secondary btn-sm" type="button"><i class="bi bi-chevron-down"></i></button>
              </div>
              <div class="p-2 bg-ca-surface border border-ca rounded-3 small">
                «La <mark class="bg-warning text-dark px-1 rounded">contraseña wifi</mark> es CasaPlaya2026»
              </div>
            </div>
          </div>
        `;

        footerHtml = `
          <button type="button" class="btn btn-outline-secondary btn-sm" id="btnTutorialSkip">Omitir tutorial</button>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm" id="btnTutorialPrev">
              <i class="bi bi-chevron-left me-1" aria-hidden="true"></i> Anterior
            </button>
            <button type="button" class="btn btn-ca-primary btn-sm px-3" id="btnTutorialNext">
              Siguiente <i class="bi bi-chevron-right ms-1" aria-hidden="true"></i>
            </button>
          </div>
        `;
        break;

      case 6:
        // Paso 6: Privacidad y funcionamiento sin conexión
        bodyHtml = `
          <div class="ca-tutorial-step">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="ca-tutorial-step-badge">6</span>
              <span class="text-ca-muted small fw-semibold text-uppercase tracking-wider">Privacidad y Offline</span>
            </div>
            <h2 class="h5 fw-bold text-ca-main mb-2">Tus conversaciones son tuyas</h2>
            <p class="text-ca-muted small mb-3">
              ChatArchive fue diseñado bajo el principio fundamental de soberanía y privacidad de tus datos:
            </p>

            <div class="d-flex flex-column gap-2 mb-3 small">
              <div class="p-2 border border-ca rounded-3 bg-ca-elevated d-flex align-items-center gap-3">
                <i class="bi bi-hdd-network text-success fs-4" aria-hidden="true"></i>
                <div>
                  <strong class="text-ca-main">Almacenamiento Local IndexedDB:</strong>
                  <span class="text-ca-muted d-block">Todo se guarda en tu dispositivo. Sin servidores externos ni bases de datos en la nube.</span>
                </div>
              </div>
              <div class="p-2 border border-ca rounded-3 bg-ca-elevated d-flex align-items-center gap-3">
                <i class="bi bi-person-x text-primary fs-4" aria-hidden="true"></i>
                <div>
                  <strong class="text-ca-main">Sin Cuentas ni Registros:</strong>
                  <span class="text-ca-muted d-block">No necesitas iniciar sesión, ingresar correos ni proporcionar datos personales.</span>
                </div>
              </div>
              <div class="p-2 border border-ca rounded-3 bg-ca-elevated d-flex align-items-center gap-3">
                <i class="bi bi-wifi-off text-info fs-4" aria-hidden="true"></i>
                <div>
                  <strong class="text-ca-main">Funcionamiento Sin Conexión (Offline):</strong>
                  <span class="text-ca-muted d-block">Consulta tus chats en cualquier momento, incluso en modo avión o sin internet.</span>
                </div>
              </div>
            </div>
            <small class="text-ca-muted d-block text-center" style="font-size: 0.78rem;">
              <i class="bi bi-shield-check text-success me-1"></i> Recuerda crear copias de seguridad periódicas desde <strong>Ajustes</strong>.
            </small>
          </div>
        `;

        footerHtml = `
          <button type="button" class="btn btn-outline-secondary btn-sm" id="btnTutorialSkip">Omitir tutorial</button>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm" id="btnTutorialPrev">
              <i class="bi bi-chevron-left me-1" aria-hidden="true"></i> Anterior
            </button>
            <button type="button" class="btn btn-success btn-sm px-3" id="btnTutorialNext">
              <span>Finalizar</span> <i class="bi bi-check2 ms-1" aria-hidden="true"></i>
            </button>
          </div>
        `;
        break;

      case 7:
        // Pantalla Final de Listo
        bodyHtml = `
          <div class="ca-tutorial-step text-center py-4">
            <div class="d-inline-flex p-3 rounded-circle bg-success-subtle text-success mb-3 shadow-sm" style="width: 72px; height: 72px; align-items: center; justify-content: center;">
              <i class="bi bi-check2-circle fs-1" aria-hidden="true"></i>
            </div>
            <h2 class="h4 fw-bold text-ca-main mb-2">¡Ya estás listo para utilizar ChatArchive!</h2>
            <p class="text-ca-muted small mb-4 mx-auto" style="max-width: 480px;">
              Ahora puedes comenzar a importar y organizar tus conversaciones. ¡Disfruta de una experiencia privada, rápida y sin límites!
            </p>
            <div class="p-3 border border-ca rounded-3 bg-ca-elevated text-start small mx-auto mb-2" style="max-width: 480px;">
              <div class="d-flex align-items-center gap-2 text-primary fw-semibold mb-1">
                <i class="bi bi-lightbulb" aria-hidden="true"></i>
                <span>Consejo útil:</span>
              </div>
              <span class="text-ca-muted">
                Puedes volver a consultar este tutorial en cualquier momento desde <strong>Ajustes → Ayuda y Bienvenida</strong>.
              </span>
            </div>
          </div>
        `;

        footerHtml = `
          <div class="w-100 text-center">
            <button type="button" class="btn btn-ca-primary btn-sm px-5 py-2 shadow-sm" id="btnTutorialFinish">
              <i class="bi bi-rocket-takeoff me-1" aria-hidden="true"></i> Comenzar a utilizar
            </button>
          </div>
        `;
        break;
    }

    stepBody.innerHTML = bodyHtml;
    footer.innerHTML = footerHtml;

    // Vincular Eventos de Botones
    footer.querySelector('#btnTutorialStart')?.addEventListener('click', () => {
      this.currentStep = 1;
      this.renderCurrentStep();
    });

    footer.querySelector('#btnTutorialNext')?.addEventListener('click', () => {
      if (this.currentStep < 7) {
        this.currentStep++;
        this.renderCurrentStep();
      }
    });

    footer.querySelector('#btnTutorialPrev')?.addEventListener('click', () => {
      if (this.currentStep > 0) {
        this.currentStep--;
        this.renderCurrentStep();
      }
    });

    footer.querySelector('#btnTutorialFinish')?.addEventListener('click', () => {
      this.completeTutorial();
    });

    footer.querySelector('#btnTutorialSkip')?.addEventListener('click', () => {
      this.skipTutorial();
    });

    footer.querySelector('#btnTutorialSkipWelcome')?.addEventListener('click', () => {
      this.skipTutorial();
    });
  }

  /**
   * Finaliza el tutorial exitosamente y persiste el estado
   */
  completeTutorial() {
    localStorage.setItem(STORAGE_KEYS.COMPLETED, 'true');
    this.closeModal('completed');
  }

  /**
   * Omite el tutorial y persiste el estado
   */
  skipTutorial() {
    localStorage.setItem(STORAGE_KEYS.SKIPPED, 'true');
    this.closeModal('skipped');
  }

  /**
   * Cierra el modal de Bootstrap y notifica a los oyentes
   * @param {'completed' | 'skipped'} reason
   */
  closeModal(reason) {
    this._isOpen = false;
    if (this.modal) {
      this.modal.hide();
    }

    // Emitir evento global de cierre
    window.dispatchEvent(new CustomEvent('tutorial:closed', { detail: { reason } }));

    // Ejecutar callbacks registrados (ej. para disparar secuencia de banner PWA tras 5 seg)
    this.closeCallbacks.forEach(cb => {
      try {
        cb(reason);
      } catch (err) {
        console.error('[TutorialManager] Error en callback de cierre:', err);
      }
    });
  }
}

// Instancia única exportada
export const tutorialManager = new TutorialManager();
