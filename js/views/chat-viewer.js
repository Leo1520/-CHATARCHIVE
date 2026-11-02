/**
 * ChatArchive - Visor Avanzado de Conversaciones (Chat Viewer)
 * Reconstrucción visual de WhatsApp, carga progresiva, multimedia, personalización y buscador integrado
 */

import { ConversationsRepository } from '../database/conversations.js';
import { MessagesRepository } from '../database/messages.js';
import { formatDate, escapeHTML, showToast } from '../utils/helpers.js';
import { mediaManager } from '../import/media-handler.js';
import { ChatSearchController } from './search.js';
import { CONFIG } from '../core/config.js';

// Preferencias locales del visor
const VIEWER_SETTINGS_KEY = 'chatarchive_viewer_settings';

export async function renderChatViewer(container, params) {
  const conversationId = params ? params.get('id') : null;

  if (!conversationId) {
    container.innerHTML = `
      <div class="container py-5 text-center">
        <div class="alert alert-warning d-inline-block p-4 rounded-4 shadow-sm" role="alert">
          <i class="bi bi-exclamation-triangle-fill fs-3 text-warning d-block mb-2" aria-hidden="true"></i>
          <h2 class="h5 fw-bold mb-2">No se especificó ninguna conversación</h2>
          <p class="text-ca-muted mb-3">Selecciona una conversación desde tu biblioteca para visualizarla.</p>
          <a href="#library" class="btn btn-ca-primary">
            <i class="bi bi-collection me-1" aria-hidden="true"></i> Ir a la Biblioteca
          </a>
        </div>
      </div>
    `;
    return;
  }

  // Cargar metadatos de la conversación
  let conversation = null;
  try {
    conversation = await ConversationsRepository.getById(conversationId);
  } catch (err) {
    console.error('[ChatArchive] Error al cargar conversación:', err);
  }

  if (!conversation) {
    container.innerHTML = `
      <div class="container py-5 text-center">
        <div class="alert alert-danger d-inline-block p-4 rounded-4 shadow-sm" role="alert">
          <i class="bi bi-x-circle-fill fs-3 text-danger d-block mb-2" aria-hidden="true"></i>
          <h2 class="h5 fw-bold mb-2">Conversación no encontrada</h2>
          <p class="text-ca-muted mb-3">La conversación solicitada no existe o fue eliminada del almacenamiento local.</p>
          <a href="#library" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left me-1" aria-hidden="true"></i> Volver a la Biblioteca
          </a>
        </div>
      </div>
    `;
    return;
  }

  // Cargar preferencias guardadas del visor
  const viewerPrefs = getViewerPreferences();

  // Asignar colores a los participantes para diferenciación visual en grupos
  const participantColors = assignParticipantColors(conversation.participants || []);

  // Determinar perspectiva inicial (original, emisor o receptor) y participante principal
  const detected = detectPrimaryParticipant(conversation);
  const perspectiveState = {
    mode: conversation.perspective?.mode || 'sender',
    primaryParticipant: conversation.perspective?.primaryParticipant || detected.name,
    isCertain: detected.isCertain,
    participants: conversation.participants || []
  };

  const totalMessagesCount = conversation.totalMessages || 0;
  const participantsCount = (conversation.participants || []).length;

  const html = `
    <div class="ca-chat-viewport ${viewerPrefs.bgClass} ${viewerPrefs.densityClass} ${viewerPrefs.bubbleClass}" id="chatViewport">
      <!-- Cabecera del Visor -->
      <header class="ca-chat-header">
        <div class="ca-chat-header-info">
          <a href="#library" class="btn btn-sm btn-outline-secondary btn-icon-only border-0" title="Volver a Biblioteca" aria-label="Volver a Biblioteca">
            <i class="bi bi-chevron-left fs-5" aria-hidden="true"></i>
          </a>
          <div class="ca-chat-avatar flex-shrink-0">
            <i class="bi bi-chat-dots" aria-hidden="true"></i>
          </div>
          <div class="min-w-0">
            <h1 class="ca-chat-title" id="chatHeaderTitle">${escapeHTML(conversation.title)}</h1>
            <p class="ca-chat-subtitle mb-0">
              <span id="headerParticipantInfo">${participantsCount} participante(s) • ${totalMessagesCount.toLocaleString()} mensajes</span>
            </p>
          </div>
        </div>

        <!-- Acciones de la Cabecera -->
        <div class="d-flex align-items-center gap-1">
          <!-- Selector de Perspectiva del Chat (Dropdown Elegante) -->
          <div class="dropdown" id="perspectiveDropdownContainer">
            <button 
              type="button" 
              class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 border-0 px-2 py-1" 
              id="btnPerspectiveDropdown"
              data-bs-toggle="dropdown" 
              data-bs-auto-close="outside"
              aria-expanded="false"
              title="Cambiar perspectiva de visualización" 
              aria-label="Cambiar perspectiva de visualización"
            >
              <i class="bi bi-arrow-left-right text-primary" aria-hidden="true"></i>
              <span class="d-none d-md-inline small fw-semibold" id="currentPerspectiveLabel">${getPerspectiveShortName(perspectiveState.mode)}</span>
              <i class="bi bi-chevron-down small text-ca-muted" aria-hidden="true"></i>
            </button>

            <div class="dropdown-menu dropdown-menu-end shadow-lg border-ca p-3" style="min-width: 285px; max-width: 320px;" aria-labelledby="btnPerspectiveDropdown">
              <div class="d-flex align-items-center justify-content-between mb-2">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-arrow-left-right text-primary" aria-hidden="true"></i>
                  <span class="fw-bold small text-ca-main">Perspectiva del Chat</span>
                </div>
                <span class="badge ca-badge-soft-primary small" id="perspectiveBadgeMode">${getPerspectiveShortName(perspectiveState.mode)}</span>
              </div>
              <p class="text-ca-muted small mb-2" style="font-size: 0.78rem; line-height: 1.35;">
                Elige cómo visualizar los mensajes sin alterar el orden ni el archivo original.
              </p>

              <!-- Botones segmentados de perspectiva -->
              <div class="btn-group w-100 mb-2" role="group" aria-label="Modo de perspectiva">
                <button 
                  type="button" 
                  class="btn btn-sm btn-outline-secondary perspective-btn ${perspectiveState.mode === 'original' ? 'active' : ''}" 
                  data-perspective="original"
                  title="Vista cronológica original con participantes diferenciados"
                >
                  <i class="bi bi-clock-history mb-1" aria-hidden="true"></i>
                  <span style="font-size: 0.72rem;">Original</span>
                </button>
                <button 
                  type="button" 
                  class="btn btn-sm btn-outline-secondary perspective-btn ${perspectiveState.mode === 'sender' ? 'active' : ''}" 
                  data-perspective="sender"
                  title="Ver como emisor principal (mensajes propios a la derecha)"
                >
                  <i class="bi bi-box-arrow-right mb-1" aria-hidden="true"></i>
                  <span style="font-size: 0.72rem;">Emisor</span>
                </button>
                <button 
                  type="button" 
                  class="btn btn-sm btn-outline-secondary perspective-btn ${perspectiveState.mode === 'receptor' ? 'active' : ''}" 
                  data-perspective="receptor"
                  title="Ver como receptor (mensajes de la otra persona a la derecha)"
                >
                  <i class="bi bi-box-arrow-in-left mb-1" aria-hidden="true"></i>
                  <span style="font-size: 0.72rem;">Receptor</span>
                </button>
              </div>

              <!-- Selector de Participante Principal -->
              <div class="border-top border-ca pt-2 mt-2">
                <div class="d-flex align-items-center justify-content-between mb-1">
                  <label class="form-label small fw-semibold text-ca-muted mb-0" for="headerPrimaryParticipantSelect" style="font-size: 0.75rem;">
                    Usuario principal:
                  </label>
                  ${perspectiveState.isCertain ? `
                    <span class="badge bg-success-subtle text-success border border-success-subtle" style="font-size: 0.65rem;" title="Detectado automáticamente">
                      <i class="bi bi-check2" aria-hidden="true"></i> Auto
                    </span>
                  ` : `
                    <span class="badge bg-warning-subtle text-warning border border-warning-subtle" style="font-size: 0.65rem;" title="Selección manual recomendada">
                      <i class="bi bi-hand-index" aria-hidden="true"></i> Manual
                    </span>
                  `}
                </div>
                <select class="form-select form-select-sm border-ca bg-transparent text-ca-main" id="headerPrimaryParticipantSelect" style="font-size: 0.8rem;">
                  ${(conversation.participants || []).map(p => `
                    <option value="${escapeHTML(p.name)}" ${p.name === perspectiveState.primaryParticipant ? 'selected' : ''}>
                      ${escapeHTML(p.name)} (${p.count} msgs)
                    </option>
                  `).join('')}
                </select>
                <small class="text-ca-muted d-block mt-1" style="font-size: 0.72rem;">
                  Participante sobre el cual se orienta la perspectiva del visor.
                </small>
              </div>
            </div>
          </div>

          <!-- Botón de Búsqueda Avanzada -->
          <button 
            type="button" 
            class="btn btn-sm btn-outline-secondary btn-icon-only border-0" 
            id="btnToggleChatSearch"
            title="Buscar en la conversación" 
            aria-label="Buscar en la conversación"
          >
            <i class="bi bi-search" aria-hidden="true"></i>
          </button>

          <!-- Botón de Personalización Visual -->
          <button 
            type="button" 
            class="btn btn-sm btn-outline-secondary btn-icon-only border-0" 
            id="btnOpenCustomizer"
            title="Personalizar aspecto del visor" 
            aria-label="Personalizar aspecto del visor"
          >
            <i class="bi bi-palette" aria-hidden="true"></i>
          </button>

          <!-- Botón de Información del Chat -->
          <button 
            type="button" 
            class="btn btn-sm btn-outline-secondary btn-icon-only border-0" 
            id="btnOpenChatInfo"
            title="Información de la conversación" 
            aria-label="Información de la conversación"
          >
            <i class="bi bi-info-circle" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <!-- Barra de Búsqueda Desplegable en el Chat -->
      <div class="ca-chat-search-bar d-none" id="chatSearchBar">
        <div class="input-group input-group-sm flex-grow-1">
          <span class="input-group-text bg-transparent border-ca text-ca-muted">
            <i class="bi bi-search" aria-hidden="true"></i>
          </span>
          <input 
            type="search" 
            id="chatSearchInput" 
            class="form-control bg-transparent border-ca text-ca-main" 
            placeholder="Buscar palabras, frases o fechas..." 
            aria-label="Buscar en esta conversación"
          >
        </div>

        <!-- Spinner y Contador de Coincidencias -->
        <div class="spinner-border spinner-border-sm text-primary d-none" id="searchSpinner" role="status">
          <span class="visually-hidden">Buscando...</span>
        </div>
        <span class="ca-search-counter-badge" id="searchCounterBadge">0 resultados</span>

        <!-- Controles de Navegación entre Resultados -->
        <button 
          type="button" 
          class="btn btn-sm btn-outline-secondary btn-icon-only" 
          id="btnSearchPrev" 
          title="Coincidencia anterior" 
          aria-label="Coincidencia anterior"
          disabled
        >
          <i class="bi bi-chevron-up" aria-hidden="true"></i>
        </button>
        <button 
          type="button" 
          class="btn btn-sm btn-outline-secondary btn-icon-only" 
          id="btnSearchNext" 
          title="Coincidencia siguiente" 
          aria-label="Coincidencia siguiente"
          disabled
        >
          <i class="bi bi-chevron-down" aria-hidden="true"></i>
        </button>

        <!-- Botón para ver lista completa de resultados -->
        <button 
          type="button" 
          class="btn btn-sm btn-outline-secondary btn-icon-only" 
          id="btnOpenSearchResultsList" 
          title="Ver lista de coincidencias" 
          aria-label="Ver lista de coincidencias"
          data-bs-toggle="offcanvas" 
          data-bs-target="#searchResultsOffcanvas"
        >
          <i class="bi bi-list-ul" aria-hidden="true"></i>
        </button>

        <!-- Botón Cerrar Búsqueda -->
        <button 
          type="button" 
          class="btn btn-sm btn-outline-secondary btn-icon-only border-0" 
          id="btnCloseChatSearch" 
          title="Cerrar búsqueda" 
          aria-label="Cerrar búsqueda"
        >
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Área de Mensajes con Scroll -->
      <main class="ca-chat-messages-container" id="chatMessagesArea" role="log" aria-live="polite">
        <!-- Indicador de carga inicial -->
        <div class="text-center py-5" id="initialLoadingSpinner">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando mensajes...</span>
          </div>
          <div class="text-ca-muted small mt-2">Cargando conversación...</div>
        </div>
      </main>

      <!-- Controles Flotantes de Navegación Rápida -->
      <div class="ca-chat-floating-controls" aria-label="Navegación rápida de mensajes">
        <button 
          type="button" 
          class="ca-floating-btn" 
          id="btnScrollToTop" 
          title="Ir al primer mensaje" 
          aria-label="Ir al primer mensaje"
        >
          <i class="bi bi-chevron-double-up" aria-hidden="true"></i>
        </button>
        <button 
          type="button" 
          class="ca-floating-btn" 
          id="btnScrollToBottom" 
          title="Ir al último mensaje" 
          aria-label="Ir al último mensaje"
        >
          <i class="bi bi-chevron-double-down" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <!-- Offcanvas de Resultados de Búsqueda -->
    <div class="offcanvas offcanvas-end bg-ca-surface border-start border-ca" tabindex="-1" id="searchResultsOffcanvas" aria-labelledby="searchResultsLabel">
      <div class="offcanvas-header border-bottom border-ca">
        <h5 class="offcanvas-title fw-bold d-flex align-items-center gap-2" id="searchResultsLabel">
          <i class="bi bi-search text-primary" aria-hidden="true"></i>
          <span>Coincidencias Encontradas</span>
        </h5>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button>
      </div>
      <div class="offcanvas-body p-3" id="searchResultsOffcanvasList">
        <div class="text-center py-4 text-ca-muted small">
          Escribe un término en la barra de búsqueda para ver los resultados aquí.
        </div>
      </div>
    </div>

    <!-- Offcanvas de Personalización Visual del Visor -->
    <div class="offcanvas offcanvas-end bg-ca-surface border-start border-ca" tabindex="-1" id="customizerOffcanvas" aria-labelledby="customizerLabel">
      <div class="offcanvas-header border-bottom border-ca">
        <h5 class="offcanvas-title fw-bold d-flex align-items-center gap-2" id="customizerLabel">
          <i class="bi bi-palette text-primary" aria-hidden="true"></i>
          <span>Personalizar Visor</span>
        </h5>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button>
      </div>
      <div class="offcanvas-body">
        <!-- Control de Perspectiva del Chat en Personalización -->
        <div class="mb-4">
          <label class="form-label small fw-semibold text-ca-muted mb-2 d-flex align-items-center justify-content-between">
            <span>Perspectiva del Chat</span>
            <span class="badge ca-badge-soft-primary" id="customizerPerspectiveBadge">${getPerspectiveShortName(perspectiveState.mode)}</span>
          </label>
          <div class="btn-group w-100 mb-2" role="group" aria-label="Perspectiva de la conversación">
            <button type="button" class="btn btn-sm btn-outline-secondary customizer-perspective-btn ${perspectiveState.mode === 'original' ? 'active' : ''}" data-perspective="original">
              <i class="bi bi-clock-history me-1" aria-hidden="true"></i> Original
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary customizer-perspective-btn ${perspectiveState.mode === 'sender' ? 'active' : ''}" data-perspective="sender">
              <i class="bi bi-box-arrow-right me-1" aria-hidden="true"></i> Emisor
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary customizer-perspective-btn ${perspectiveState.mode === 'receptor' ? 'active' : ''}" data-perspective="receptor">
              <i class="bi bi-box-arrow-in-left me-1" aria-hidden="true"></i> Receptor
            </button>
          </div>
          ${conversation.participants && conversation.participants.length > 1 ? `
            <div class="mt-2">
              <label class="form-label small text-ca-muted mb-1" for="customizerParticipantSelect">Participante principal:</label>
              <select class="form-select form-select-sm border-ca bg-transparent text-ca-main" id="customizerParticipantSelect">
                ${(conversation.participants || []).map(p => `
                  <option value="${escapeHTML(p.name)}" ${p.name === perspectiveState.primaryParticipant ? 'selected' : ''}>
                    ${escapeHTML(p.name)} (${p.count} mensajes)
                  </option>
                `).join('')}
              </select>
            </div>
          ` : ''}
        </div>

        <div class="mb-4">
          <label class="form-label small fw-semibold text-ca-muted mb-2">Densidad de Mensajes</label>
          <div class="btn-group w-100" role="group">
            <button type="button" class="btn btn-sm btn-outline-secondary ${viewerPrefs.densityClass === 'density-compact' ? 'active' : ''}" data-pref="density" data-val="density-compact">Compacta</button>
            <button type="button" class="btn btn-sm btn-outline-secondary ${viewerPrefs.densityClass === 'density-normal' ? 'active' : ''}" data-pref="density" data-val="density-normal">Normal</button>
            <button type="button" class="btn btn-sm btn-outline-secondary ${viewerPrefs.densityClass === 'density-spacious' ? 'active' : ''}" data-pref="density" data-val="density-spacious">Espaciosa</button>
          </div>
        </div>

        <div class="mb-4">
          <label class="form-label small fw-semibold text-ca-muted mb-2">Estilo de Burbuja</label>
          <div class="btn-group w-100" role="group">
            <button type="button" class="btn btn-sm btn-outline-secondary ${viewerPrefs.bubbleClass === 'bubble-style-modern' ? 'active' : ''}" data-pref="bubble" data-val="bubble-style-modern">Moderna</button>
            <button type="button" class="btn btn-sm btn-outline-secondary ${viewerPrefs.bubbleClass === 'bubble-style-classic' ? 'active' : ''}" data-pref="bubble" data-val="bubble-style-classic">Clásica</button>
            <button type="button" class="btn btn-sm btn-outline-secondary ${viewerPrefs.bubbleClass === 'bubble-style-flat' ? 'active' : ''}" data-pref="bubble" data-val="bubble-style-flat">Plana</button>
          </div>
        </div>

        <div class="mb-4">
          <label class="form-label small fw-semibold text-ca-muted mb-2">Fondo del Visor</label>
          <div class="row g-2">
            <div class="col-6">
              <button type="button" class="btn btn-sm w-100 border text-start p-2 d-flex align-items-center gap-2 ${viewerPrefs.bgClass === 'chat-bg-default' ? 'border-primary' : 'border-ca'}" data-pref="bg" data-val="chat-bg-default">
                <span class="p-2 rounded bg-secondary-subtle"></span>
                <span>Predeterminado</span>
              </button>
            </div>
            <div class="col-6">
              <button type="button" class="btn btn-sm w-100 border text-start p-2 d-flex align-items-center gap-2 ${viewerPrefs.bgClass === 'chat-bg-mint' ? 'border-primary' : 'border-ca'}" data-pref="bg" data-val="chat-bg-mint">
                <span class="p-2 rounded bg-success-subtle"></span>
                <span>Menta Suave</span>
              </button>
            </div>
            <div class="col-6">
              <button type="button" class="btn btn-sm w-100 border text-start p-2 d-flex align-items-center gap-2 ${viewerPrefs.bgClass === 'chat-bg-doodle' ? 'border-primary' : 'border-ca'}" data-pref="bg" data-val="chat-bg-doodle">
                <span class="p-2 rounded bg-info-subtle"></span>
                <span>Puntos Sutil</span>
              </button>
            </div>
            <div class="col-6">
              <button type="button" class="btn btn-sm w-100 border text-start p-2 d-flex align-items-center gap-2 ${viewerPrefs.bgClass === 'chat-bg-parchment' ? 'border-primary' : 'border-ca'}" data-pref="bg" data-val="chat-bg-parchment">
                <span class="p-2 rounded bg-warning-subtle"></span>
                <span>Pergamino</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Información de la Conversación -->
    <div class="modal fade" id="chatInfoModal" tabindex="-1" aria-labelledby="chatInfoModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header border-ca">
            <h5 class="modal-title fw-bold d-flex align-items-center gap-2" id="chatInfoModalLabel">
              <i class="bi bi-info-circle text-primary" aria-hidden="true"></i>
              <span>Detalles de la Conversación</span>
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body">
            <div class="text-center mb-4">
              <div class="ca-chat-avatar mx-auto mb-2" style="width: 64px; height: 64px; font-size: 1.8rem;">
                <i class="bi bi-chat-dots" aria-hidden="true"></i>
              </div>
              <h3 class="h5 fw-bold mb-1">${escapeHTML(conversation.title)}</h3>
              <span class="badge ca-badge-soft-success">${totalMessagesCount.toLocaleString()} mensajes</span>
            </div>

            <div class="list-group list-group-flush border-ca rounded-3 small mb-3">
              <div class="list-group-item bg-transparent border-ca d-flex justify-content-between">
                <span class="text-ca-muted">Primer mensaje:</span>
                <strong>${conversation.firstDate ? formatDate(conversation.firstDate, true) : 'Desconocido'}</strong>
              </div>
              <div class="list-group-item bg-transparent border-ca d-flex justify-content-between">
                <span class="text-ca-muted">Último mensaje:</span>
                <strong>${conversation.lastDate ? formatDate(conversation.lastDate, true) : 'Desconocido'}</strong>
              </div>
              <div class="list-group-item bg-transparent border-ca d-flex justify-content-between">
                <span class="text-ca-muted">Archivos multimedia:</span>
                <strong>${conversation.mediaCount || 0}</strong>
              </div>
              <div class="list-group-item bg-transparent border-ca d-flex justify-content-between">
                <span class="text-ca-muted">Fecha de importación:</span>
                <strong>${conversation.importedAt ? formatDate(conversation.importedAt, true) : ''}</strong>
              </div>
            </div>

            <h4 class="h6 fw-bold mb-2">Participantes (${participantsCount})</h4>
            <div class="d-flex flex-wrap gap-1">
              ${(conversation.participants || []).map(p => `
                <span class="badge ca-badge-soft-info p-2 rounded-3 d-inline-flex align-items-center gap-1">
                  <i class="bi bi-person" aria-hidden="true"></i>
                  <span>${escapeHTML(p.name)}</span>
                  <span class="badge bg-secondary rounded-pill ms-1">${p.count}</span>
                </span>
              `).join('')}
            </div>
          </div>
          <div class="modal-footer border-ca">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Lightbox para Imágenes -->
    <div class="modal fade" id="imageLightboxModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content bg-transparent border-0 shadow-none">
          <div class="modal-body p-0 text-center position-relative">
            <button type="button" class="btn-close btn-close-white position-absolute top-0 end-0 m-3 z-3" data-bs-dismiss="modal" aria-label="Cerrar imagen"></button>
            <img src="" id="lightboxImage" class="img-fluid rounded-4 shadow-lg" style="max-height: 85vh; object-fit: contain;" alt="Vista previa de imagen">
            <div id="lightboxCaption" class="mt-2 text-white small px-3"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Iniciar la carga progresiva de mensajes
  const chatContext = await initProgressiveMessageLoading(conversation, container, participantColors, perspectiveState);
  setupViewerControls(conversation, container, chatContext, perspectiveState, participantColors);
}

/**
 * Carga mensajes de forma progresiva por bloques (50 por bloque)
 */
async function initProgressiveMessageLoading(conversation, container, participantColors, perspectiveState) {
  const messagesArea = container.querySelector('#chatMessagesArea');
  const spinner = container.querySelector('#initialLoadingSpinner');

  const pageSize = 50;
  let currentOffset = 0;
  let isFetching = false;
  let hasMore = true;
  let lastRenderedDateKey = null;

  const loadNextBatch = async () => {
    if (isFetching || !hasMore) return;
    isFetching = true;

    try {
      const batch = await MessagesRepository.getMessagesByConversation(conversation.id, currentOffset, pageSize);
      spinner?.remove();

      if (batch.length === 0) {
        hasMore = false;
        if (currentOffset === 0) {
          messagesArea.innerHTML = `
            <div class="text-center py-5">
              <i class="bi bi-chat-left-text fs-2 text-ca-muted mb-2 d-block" aria-hidden="true"></i>
              <p class="text-ca-muted small">Esta conversación no contiene mensajes registrados.</p>
            </div>
          `;
        }
        return;
      }

      for (const msg of batch) {
        if (msg.dateKey && msg.dateKey !== lastRenderedDateKey) {
          lastRenderedDateKey = msg.dateKey;
          const dateSeparator = document.createElement('div');
          dateSeparator.className = 'ca-date-separator';
          dateSeparator.textContent = msg.date ? formatDate(msg.date) : msg.rawDate;
          messagesArea.appendChild(dateSeparator);
        }

        const msgRow = await renderMessageRow(msg, perspectiveState, conversation.id, participantColors);
        messagesArea.appendChild(msgRow);
      }

      currentOffset += batch.length;
      if (batch.length < pageSize) {
        hasMore = false;
      }
    } catch (err) {
      console.error('[ChatArchive] Error al cargar lote de mensajes:', err);
    } finally {
      isFetching = false;
    }
  };

  // Cargar primer lote
  await loadNextBatch();

  messagesArea.addEventListener('scroll', () => {
    const scrollBottom = messagesArea.scrollHeight - messagesArea.scrollTop - messagesArea.clientHeight;
    if (scrollBottom < 150 && hasMore && !isFetching) {
      loadNextBatch();
    }
  });

  const jumpToEnd = async () => {
    if (isFetching) return;

    // Si ya no hay más mensajes por cargar (todos están en pantalla)
    if (!hasMore) {
      messagesArea.scrollTo({ top: messagesArea.scrollHeight, behavior: 'smooth' });
      return;
    }

    const total = conversation.messagesCount || (await MessagesRepository.countByConversation(conversation.id));
    const remaining = total - currentOffset;

    // Si quedan pocos mensajes (menos de 100), cargarlos en 1-2 lotes
    if (remaining <= 100) {
      isFetching = true;
      try {
        while (hasMore && currentOffset < total) {
          const batch = await MessagesRepository.getMessagesByConversation(conversation.id, currentOffset, pageSize);
          if (batch.length === 0) {
            hasMore = false;
            break;
          }
          for (const msg of batch) {
            if (msg.dateKey && msg.dateKey !== lastRenderedDateKey) {
              lastRenderedDateKey = msg.dateKey;
              const dateSeparator = document.createElement('div');
              dateSeparator.className = 'ca-date-separator';
              dateSeparator.textContent = msg.date ? formatDate(msg.date) : msg.rawDate;
              messagesArea.appendChild(dateSeparator);
            }
            const msgRow = await renderMessageRow(msg, perspectiveState, conversation.id, participantColors);
            messagesArea.appendChild(msgRow);
          }
          currentOffset += batch.length;
          if (batch.length < pageSize) hasMore = false;
        }
      } finally {
        isFetching = false;
      }
      messagesArea.scrollTo({ top: messagesArea.scrollHeight, behavior: 'smooth' });
      return;
    }

    // Si quedan miles de mensajes (ej. 26.000 msgs), saltar instantáneamente al último bloque
    isFetching = true;
    try {
      const lastBatchOffset = Math.max(0, total - 50);
      const lastBatch = await MessagesRepository.getMessagesByConversation(conversation.id, lastBatchOffset, 50);

      messagesArea.innerHTML = '';
      lastRenderedDateKey = null;

      // Banner interactivo para recuperar mensajes anteriores si el usuario lo desea
      const notice = document.createElement('div');
      notice.className = 'text-center py-2 mb-3 ca-jumped-banner';
      notice.innerHTML = `
        <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill shadow-sm" id="btnLoadEarlierChunk">
          <i class="bi bi-clock-history me-1" aria-hidden="true"></i> Cargar mensajes anteriores (${lastBatchOffset.toLocaleString()} restantes)
        </button>
      `;
      messagesArea.appendChild(notice);

      let earliestOffset = lastBatchOffset;
      notice.querySelector('#btnLoadEarlierChunk')?.addEventListener('click', async () => {
        const btn = notice.querySelector('#btnLoadEarlierChunk');
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Cargando...';
        }
        const prevOffset = Math.max(0, earliestOffset - 50);
        const prevLimit = earliestOffset - prevOffset;
        if (prevLimit > 0) {
          const prevBatch = await MessagesRepository.getMessagesByConversation(conversation.id, prevOffset, prevLimit);
          const frag = document.createDocumentFragment();
          let prevDateKey = null;
          for (const m of prevBatch) {
            if (m.dateKey && m.dateKey !== prevDateKey) {
              prevDateKey = m.dateKey;
              const sep = document.createElement('div');
              sep.className = 'ca-date-separator';
              sep.textContent = m.date ? formatDate(m.date) : m.rawDate;
              frag.appendChild(sep);
            }
            const row = await renderMessageRow(m, perspectiveState, conversation.id, participantColors);
            frag.appendChild(row);
          }
          notice.after(frag);
          earliestOffset = prevOffset;
          if (earliestOffset <= 0) {
            notice.remove();
          } else if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="bi bi-clock-history me-1" aria-hidden="true"></i> Cargar mensajes anteriores (${earliestOffset.toLocaleString()} restantes)`;
          }
        } else {
          notice.remove();
        }
      });

      for (const msg of lastBatch) {
        if (msg.dateKey && msg.dateKey !== lastRenderedDateKey) {
          lastRenderedDateKey = msg.dateKey;
          const dateSeparator = document.createElement('div');
          dateSeparator.className = 'ca-date-separator';
          dateSeparator.textContent = msg.date ? formatDate(msg.date) : msg.rawDate;
          messagesArea.appendChild(dateSeparator);
        }
        const msgRow = await renderMessageRow(msg, perspectiveState, conversation.id, participantColors);
        messagesArea.appendChild(msgRow);
      }

      currentOffset = total;
      hasMore = false;
    } catch (err) {
      console.error('[ChatArchive] Error al saltar al último mensaje:', err);
    } finally {
      isFetching = false;
    }

    setTimeout(() => {
      messagesArea.scrollTo({ top: messagesArea.scrollHeight, behavior: 'smooth' });
    }, 50);
  };

  const jumpToStart = async () => {
    if (messagesArea.querySelector('[data-msg-index="0"]')) {
      messagesArea.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    isFetching = true;
    try {
      messagesArea.innerHTML = '';
      currentOffset = 0;
      hasMore = true;
      lastRenderedDateKey = null;
      await loadNextBatch();
    } finally {
      isFetching = false;
    }
    messagesArea.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const chatContext = {
    jumpToEnd,
    jumpToStart,
    loadChunkAroundIndex: async (targetIndex) => {
      const chunk = await MessagesRepository.getMessagesAroundIndex(conversation.id, targetIndex, 25, 30);
      for (const msg of chunk) {
        // Verificar si ya existe en el DOM
        if (!messagesArea.querySelector(`[data-msg-index="${msg.index}"]`)) {
          const msgRow = await renderMessageRow(msg, perspectiveState, conversation.id, participantColors);
          messagesArea.appendChild(msgRow);
        }
      }
    }
  };

  container._chatLoader = chatContext;
  return chatContext;
}

/**
 * Renderiza un mensaje individual con data-msg-index para localización del buscador
 * y data-sender para adaptación reactiva de la perspectiva
 */
async function renderMessageRow(msg, perspectiveState, conversationId, participantColors) {
  const row = document.createElement('div');
  const msgIndex = msg.index !== undefined ? msg.index : msg.id;
  row.setAttribute('data-msg-index', msgIndex);
  row.setAttribute('data-sender', msg.sender || '');
  row.setAttribute('data-msg-type', msg.type || 'message');

  if (msg.type === 'system') {
    row.className = 'ca-message-row system';
    row.innerHTML = `
      <div class="ca-message-system-box">
        <i class="bi bi-info-circle me-1" aria-hidden="true"></i>
        <span>${escapeHTML(msg.text)}</span>
      </div>
    `;
    return row;
  }

  const { mode, primaryParticipant, participants } = perspectiveState;
  const isOutgoing = isSenderOutgoing(msg.sender, mode, primaryParticipant, participants);
  row.className = `ca-message-row ${isOutgoing ? 'outgoing' : 'incoming'}`;

  const bubble = document.createElement('div');
  bubble.className = `ca-message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`;

  let authorHtml = '';
  const showAuthor = shouldShowAuthor(msg.sender, isOutgoing, mode, participants);
  if (showAuthor && msg.sender) {
    const color = (participantColors && participantColors[msg.sender]) || 'var(--ca-primary)';
    authorHtml = `<div class="ca-message-author" style="color: ${color};">${escapeHTML(msg.sender)}</div>`;
  }

  let mediaHtml = '';
  if (msg.attachment) {
    const { fileName, mediaType, isOmitted } = msg.attachment;

    if (isOmitted) {
      mediaHtml = `
        <div class="ca-media-missing my-1">
          <i class="bi bi-file-earmark-x" aria-hidden="true"></i>
          <span>Archivo multimedia omitido por WhatsApp</span>
        </div>
      `;
    } else if (fileName) {
      const blob = await MessagesRepository.getMediaBlob(conversationId, fileName);

      if (blob) {
        const objectUrl = URL.createObjectURL(blob);

        if (mediaType === 'image') {
          mediaHtml = `
            <div class="ca-media-attachment">
              <img 
                src="${objectUrl}" 
                class="ca-media-image" 
                alt="${escapeHTML(fileName)}" 
                data-lightbox-src="${objectUrl}"
                data-lightbox-caption="${escapeHTML(fileName)}"
                loading="lazy"
              >
            </div>
          `;
        } else if (mediaType === 'audio') {
          mediaHtml = `
            <div class="ca-media-attachment">
              <audio controls class="ca-media-audio-player" src="${objectUrl}" preload="metadata"></audio>
            </div>
          `;
        } else if (mediaType === 'video') {
          mediaHtml = `
            <div class="ca-media-attachment">
              <video controls class="ca-media-video-player" src="${objectUrl}" preload="metadata"></video>
            </div>
          `;
        } else {
          mediaHtml = `
            <div class="ca-media-attachment">
              <a href="${objectUrl}" download="${escapeHTML(fileName)}" class="ca-media-file-card" target="_blank">
                <i class="bi ${mediaManager.getIconClass(fileName)} fs-3 text-primary" aria-hidden="true"></i>
                <div class="text-truncate">
                  <div class="fw-semibold text-truncate small">${escapeHTML(fileName)}</div>
                  <small class="text-ca-muted">${(blob.size / 1024).toFixed(1)} KB • Toca para descargar</small>
                </div>
              </a>
            </div>
          `;
        }
      } else {
        mediaHtml = `
          <div class="ca-media-missing my-1">
            <i class="bi ${mediaManager.getIconClass(fileName)}" aria-hidden="true"></i>
            <span>${escapeHTML(fileName)} (No disponible en este respaldo)</span>
          </div>
        `;
      }
    }
  }

  let textHtml = '';
  if (msg.text && !msg.attachment) {
    textHtml = `<p class="ca-message-text">${escapeHTML(msg.text)}</p>`;
  } else if (msg.text && msg.attachment && msg.text !== msg.attachment.fileName) {
    textHtml = `<p class="ca-message-text mt-1">${escapeHTML(msg.text)}</p>`;
  }

  const metaHtml = `
    <span class="ca-message-meta">
      <span>${escapeHTML(msg.rawTime || '')}</span>
    </span>
  `;

  bubble.innerHTML = `${authorHtml}${mediaHtml}${textHtml}${metaHtml}`;
  row.appendChild(bubble);

  const imgEl = bubble.querySelector('.ca-media-image');
  if (imgEl) {
    imgEl.addEventListener('click', () => {
      const lightboxModal = document.getElementById('imageLightboxModal');
      const lightboxImg = document.getElementById('lightboxImage');
      const lightboxCaption = document.getElementById('lightboxCaption');
      if (lightboxModal && lightboxImg) {
        lightboxImg.src = imgEl.getAttribute('data-lightbox-src');
        lightboxCaption.textContent = imgEl.getAttribute('data-lightbox-caption') || '';
        if (window.bootstrap && window.bootstrap.Modal) {
          new window.bootstrap.Modal(lightboxModal).show();
        }
      }
    });
  }

  return row;
}

/**
 * Configura los botones flotantes, modales y el buscador integrado
 */
function setupViewerControls(conversation, container, chatContext, perspectiveState, participantColors) {
  const messagesArea = container.querySelector('#chatMessagesArea');
  const btnScrollTop = container.querySelector('#btnScrollToTop');
  const btnScrollBottom = container.querySelector('#btnScrollToBottom');
  const btnCustomizer = container.querySelector('#btnOpenCustomizer');
  const btnInfo = container.querySelector('#btnOpenChatInfo');
  const btnToggleSearch = container.querySelector('#btnToggleChatSearch');
  const btnCloseSearch = container.querySelector('#btnCloseChatSearch');
  const searchInput = container.querySelector('#chatSearchInput');
  const btnSearchPrev = container.querySelector('#btnSearchPrev');
  const btnSearchNext = container.querySelector('#btnSearchNext');

  // Inicializar controlador de búsqueda
  const searchCtrl = new ChatSearchController(conversation, chatContext);

  if (btnToggleSearch) {
    btnToggleSearch.addEventListener('click', () => searchCtrl.toggleSearchBar());
  }

  if (btnCloseSearch) {
    btnCloseSearch.addEventListener('click', () => searchCtrl.closeSearch());
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => searchCtrl.onSearchInput(e.target.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          searchCtrl.prevMatch();
        } else {
          searchCtrl.nextMatch();
        }
      } else if (e.key === 'Escape') {
        searchCtrl.closeSearch();
      }
    });
  }

  if (btnSearchPrev) {
    btnSearchPrev.addEventListener('click', () => searchCtrl.prevMatch());
  }

  if (btnSearchNext) {
    btnSearchNext.addEventListener('click', () => searchCtrl.nextMatch());
  }

  // 1. Ir al primer mensaje
  if (btnScrollTop && messagesArea) {
    btnScrollTop.addEventListener('click', () => {
      if (chatContext?.jumpToStart) {
        chatContext.jumpToStart();
      } else {
        messagesArea.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // 2. Ir al último mensaje
  if (btnScrollBottom && messagesArea) {
    btnScrollBottom.addEventListener('click', () => {
      if (chatContext?.jumpToEnd) {
        chatContext.jumpToEnd();
      } else {
        messagesArea.scrollTo({ top: messagesArea.scrollHeight, behavior: 'smooth' });
      }
    });
  }

  // 3. Abrir modal de info
  if (btnInfo) {
    btnInfo.addEventListener('click', () => {
      const modalEl = container.querySelector('#chatInfoModal');
      if (modalEl && window.bootstrap && window.bootstrap.Modal) {
        new window.bootstrap.Modal(modalEl).show();
      }
    });
  }

  // 4. Abrir offcanvas de personalización
  if (btnCustomizer) {
    btnCustomizer.addEventListener('click', () => {
      const offcanvasEl = container.querySelector('#customizerOffcanvas');
      if (offcanvasEl && window.bootstrap && window.bootstrap.Offcanvas) {
        new window.bootstrap.Offcanvas(offcanvasEl).show();
      }
    });
  }

  // 5. Opciones de personalización reactiva
  const viewport = container.querySelector('#chatViewport');
  container.querySelectorAll('[data-pref]').forEach(btn => {
    btn.addEventListener('click', () => {
      const prefType = btn.getAttribute('data-pref');
      const val = btn.getAttribute('data-val');
      const currentPrefs = getViewerPreferences();

      btn.parentElement.parentElement?.querySelectorAll(`[data-pref="${prefType}"]`).forEach(b => b.classList.remove('active', 'border-primary'));
      btn.classList.add('active', 'border-primary');

      if (prefType === 'density') {
        viewport.classList.remove('density-compact', 'density-normal', 'density-spacious');
        viewport.classList.add(val);
        currentPrefs.densityClass = val;
      } else if (prefType === 'bubble') {
        viewport.classList.remove('bubble-style-modern', 'bubble-style-classic', 'bubble-style-flat');
        viewport.classList.add(val);
        currentPrefs.bubbleClass = val;
      } else if (prefType === 'bg') {
        viewport.classList.remove('chat-bg-default', 'chat-bg-mint', 'chat-bg-doodle', 'chat-bg-parchment');
        viewport.classList.add(val);
        currentPrefs.bgClass = val;
      }

      saveViewerPreferences(currentPrefs);
    });
  });

  // 6. Controlador de Cambio de Perspectiva (Original / Emisor / Receptor)
  const updatePerspective = async (newMode, newPrimary) => {
    let modeChanged = newMode && newMode !== perspectiveState.mode;
    let participantChanged = newPrimary && newPrimary !== perspectiveState.primaryParticipant;

    if (!modeChanged && !participantChanged) return;

    if (modeChanged) perspectiveState.mode = newMode;
    if (participantChanged) perspectiveState.primaryParticipant = newPrimary;

    // A. Actualizar reactiva e inmediatamente los mensajes en el DOM
    applyPerspectiveToDOM(container, perspectiveState, participantColors);

    // B. Sincronizar UI de la cabecera
    const currentPerspectiveLabel = container.querySelector('#currentPerspectiveLabel');
    if (currentPerspectiveLabel) {
      currentPerspectiveLabel.textContent = getPerspectiveShortName(perspectiveState.mode);
    }
    const perspectiveBadgeMode = container.querySelector('#perspectiveBadgeMode');
    if (perspectiveBadgeMode) {
      perspectiveBadgeMode.textContent = getPerspectiveShortName(perspectiveState.mode);
    }
    container.querySelectorAll('.perspective-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-perspective') === perspectiveState.mode);
    });

    const headerPrimarySelect = container.querySelector('#headerPrimaryParticipantSelect');
    if (headerPrimarySelect && headerPrimarySelect.value !== perspectiveState.primaryParticipant) {
      headerPrimarySelect.value = perspectiveState.primaryParticipant;
    }

    // C. Sincronizar UI del offcanvas de personalización
    const customizerBadge = container.querySelector('#customizerPerspectiveBadge');
    if (customizerBadge) {
      customizerBadge.textContent = getPerspectiveShortName(perspectiveState.mode);
    }
    container.querySelectorAll('.customizer-perspective-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-perspective') === perspectiveState.mode);
    });
    const customizerSelect = container.querySelector('#customizerParticipantSelect');
    if (customizerSelect && customizerSelect.value !== perspectiveState.primaryParticipant) {
      customizerSelect.value = perspectiveState.primaryParticipant;
    }

    // D. Persistir la preferencia de perspectiva de la conversación en IndexedDB
    try {
      conversation.perspective = {
        mode: perspectiveState.mode,
        primaryParticipant: perspectiveState.primaryParticipant
      };
      await ConversationsRepository.save(conversation);
    } catch (err) {
      console.error('[ChatArchive] Error al persistir la perspectiva en IndexedDB:', err);
    }

    // E. Notificación al usuario
    showToast(`Perspectiva: ${getPerspectiveLabel(perspectiveState.mode)}`, 'info', 1800);
  };

  // Botones de perspectiva en la cabecera
  container.querySelectorAll('.perspective-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-perspective');
      updatePerspective(mode, null);
    });
  });

  // Selector de participante en la cabecera
  container.querySelector('#headerPrimaryParticipantSelect')?.addEventListener('change', (e) => {
    updatePerspective(null, e.target.value);
  });

  // Botones de perspectiva en el Offcanvas de personalización
  container.querySelectorAll('.customizer-perspective-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-perspective');
      updatePerspective(mode, null);
    });
  });

  // Selector de participante en el Offcanvas de personalización
  container.querySelector('#customizerParticipantSelect')?.addEventListener('change', (e) => {
    updatePerspective(null, e.target.value);
  });
}

/**
 * Detecta el usuario principal exportador de la conversación
 */
function detectPrimaryParticipant(conversation) {
  const participants = conversation.participants || [];
  if (participants.length === 0) {
    return { name: '', isCertain: false };
  }

  // 1. Si ya se guardó una preferencia de perspectiva previa
  if (conversation.perspective && conversation.perspective.primaryParticipant) {
    const exists = participants.some(p => p.name === conversation.perspective.primaryParticipant);
    if (exists) {
      return { 
        name: conversation.perspective.primaryParticipant, 
        isCertain: true 
      };
    }
  }

  // 2. Buscar participante denominado 'Tú' o 'You'
  const you = participants.find(p => {
    const n = (p.name || '').trim().toLowerCase();
    return n === 'tú' || n === 'tu' || n === 'you';
  });
  if (you) {
    return { name: you.name, isCertain: true };
  }

  // 3. Fallback: primer participante, marcado como no cierto (para sugerir selección manual)
  return { name: participants[0]?.name || '', isCertain: false };
}

/**
 * Determina si un mensaje debe posicionarse a la derecha (outgoing) según la perspectiva seleccionada
 */
function isSenderOutgoing(sender, mode, primaryParticipant, participants) {
  if (!sender) return false;
  const sTrim = sender.trim().toLowerCase();

  // 1. Vista Original: respeta la exportación de WhatsApp ('Tú'/'You' a la derecha, los demás a la izquierda)
  if (mode === 'original') {
    return sTrim === 'tú' || sTrim === 'tu' || sTrim === 'you';
  }

  // 2. Ver como Emisor: el usuario principal exportador siempre aparece a la derecha
  if (mode === 'sender') {
    return sender === primaryParticipant;
  }

  // 3. Ver como Receptor: invierte la perspectiva (la otra persona a la derecha, el usuario principal a la izquierda)
  if (mode === 'receptor' || mode === 'receiver') {
    if (participants && participants.length === 2) {
      const other = participants.find(p => p.name !== primaryParticipant);
      return other ? sender === other.name : sender !== primaryParticipant;
    }
    // En conversaciones grupales (> 2 participantes):
    // El usuario principal pasa a la izquierda y el resto de los participantes a la derecha
    return sender !== primaryParticipant;
  }

  return sender === primaryParticipant;
}

/**
 * Determina si se debe mostrar el encabezado del nombre del autor en la burbuja
 */
function shouldShowAuthor(sender, isOutgoing, mode, participants) {
  if (!sender) return false;

  // En conversaciones grupales (> 2 participantes), siempre identificar a los participantes
  if (participants && participants.length > 2) {
    // Si es el emisor principal a la derecha en modo emisor, su nombre se puede omitir como en WhatsApp
    if (isOutgoing && mode === 'sender') {
      return false;
    }
    // Todos los demás participantes (o en modo receptor a la derecha/izquierda) muestran su nombre y color
    return true;
  }

  // En conversaciones 1 a 1:
  // Mensajes a la derecha (outgoing) no llevan nombre de autor
  // Mensajes a la izquierda (incoming) muestran el nombre de la otra persona
  return !isOutgoing;
}

/**
 * Aplica la perspectiva actual a todos los mensajes ya presentes en el DOM de forma reactiva e instantánea
 */
function applyPerspectiveToDOM(container, perspectiveState, participantColors) {
  const { mode, primaryParticipant, participants } = perspectiveState;
  const rows = container.querySelectorAll('.ca-message-row:not(.system)');

  rows.forEach(row => {
    const sender = row.getAttribute('data-sender') || '';
    const isOutgoing = isSenderOutgoing(sender, mode, primaryParticipant, participants);

    row.classList.remove('outgoing', 'incoming');
    row.classList.add(isOutgoing ? 'outgoing' : 'incoming');

    const bubble = row.querySelector('.ca-message-bubble');
    if (bubble) {
      bubble.classList.remove('outgoing', 'incoming');
      bubble.classList.add(isOutgoing ? 'outgoing' : 'incoming');

      let authorEl = bubble.querySelector('.ca-message-author');
      const showAuthor = shouldShowAuthor(sender, isOutgoing, mode, participants);

      if (showAuthor && sender) {
        const color = (participantColors && participantColors[sender]) || 'var(--ca-primary)';
        if (!authorEl) {
          authorEl = document.createElement('div');
          authorEl.className = 'ca-message-author';
          bubble.prepend(authorEl);
        }
        authorEl.style.color = color;
        authorEl.textContent = sender;
      } else if (!showAuthor && authorEl) {
        authorEl.remove();
      }
    }
  });
}

function getPerspectiveLabel(mode) {
  switch (mode) {
    case 'original': return 'Vista original';
    case 'receiver':
    case 'receptor': return 'Ver como receptor';
    case 'sender':
    default: return 'Ver como emisor';
  }
}

function getPerspectiveShortName(mode) {
  switch (mode) {
    case 'original': return 'Original';
    case 'receiver':
    case 'receptor': return 'Receptor';
    case 'sender':
    default: return 'Emisor';
  }
}

function determineOutgoingSender(participants) {
  if (!participants || participants.length === 0) return null;
  const you = participants.find(p => p.name.toLowerCase() === 'tú' || p.name.toLowerCase() === 'you');
  if (you) return you.name;
  return participants[0]?.name || null;
}

function assignParticipantColors(participants) {
  const colors = [
    '#059669', '#0284c7', '#8b5cf6', '#d97706', '#dc2626',
    '#0d9488', '#e11d48', '#4f46e5', '#ca8a04', '#16a34a'
  ];
  const map = {};
  participants.forEach((p, idx) => {
    map[p.name] = colors[idx % colors.length];
  });
  return map;
}

function getViewerPreferences() {
  try {
    const raw = localStorage.getItem(VIEWER_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return {
    densityClass: 'density-normal',
    bubbleClass: 'bubble-style-modern',
    bgClass: 'chat-bg-default'
  };
}

function saveViewerPreferences(prefs) {
  try {
    localStorage.setItem(VIEWER_SETTINGS_KEY, JSON.stringify(prefs));
  } catch (e) {}
}
