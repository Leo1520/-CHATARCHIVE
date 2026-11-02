/**
 * ChatArchive - Visor Avanzado de Conversaciones (Chat Viewer)
 * Reconstrucción visual de WhatsApp, carga progresiva, multimedia, personalización y navegación
 */

import { ConversationsRepository } from '../database/conversations.js';
import { MessagesRepository } from '../database/messages.js';
import { formatDate, escapeHTML, showToast } from '../utils/helpers.js';
import { mediaManager } from '../import/media-handler.js';
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
        <!-- Modo de Densidad -->
        <div class="mb-4">
          <label class="form-label small fw-semibold text-ca-muted mb-2">Densidad de Mensajes</label>
          <div class="btn-group w-100" role="group">
            <button type="button" class="btn btn-sm btn-outline-secondary ${viewerPrefs.densityClass === 'density-compact' ? 'active' : ''}" data-pref="density" data-val="density-compact">Compacta</button>
            <button type="button" class="btn btn-sm btn-outline-secondary ${viewerPrefs.densityClass === 'density-normal' ? 'active' : ''}" data-pref="density" data-val="density-normal">Normal</button>
            <button type="button" class="btn btn-sm btn-outline-secondary ${viewerPrefs.densityClass === 'density-spacious' ? 'active' : ''}" data-pref="density" data-val="density-spacious">Espaciosa</button>
          </div>
        </div>

        <!-- Estilo de Burbujas -->
        <div class="mb-4">
          <label class="form-label small fw-semibold text-ca-muted mb-2">Estilo de Burbuja</label>
          <div class="btn-group w-100" role="group">
            <button type="button" class="btn btn-sm btn-outline-secondary ${viewerPrefs.bubbleClass === 'bubble-style-modern' ? 'active' : ''}" data-pref="bubble" data-val="bubble-style-modern">Moderna</button>
            <button type="button" class="btn btn-sm btn-outline-secondary ${viewerPrefs.bubbleClass === 'bubble-style-classic' ? 'active' : ''}" data-pref="bubble" data-val="bubble-style-classic">Clásica</button>
            <button type="button" class="btn btn-sm btn-outline-secondary ${viewerPrefs.bubbleClass === 'bubble-style-flat' ? 'active' : ''}" data-pref="bubble" data-val="bubble-style-flat">Plana</button>
          </div>
        </div>

        <!-- Fondo del Chat -->
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

        <div class="p-3 border-ca border rounded-3 bg-ca-elevated small text-ca-muted">
          <i class="bi bi-info-circle me-1" aria-hidden="true"></i>
          Las personalizaciones no alteran los mensajes originales almacenados.
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

    <!-- Modal / Lightbox para Ver Imágenes a Pantalla Completa -->
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
  initProgressiveMessageLoading(conversation, container, participantColors);
  setupViewerControls(conversation, container);
}

/**
 * Carga mensajes de forma progresiva por bloques (50 por bloque)
 */
async function initProgressiveMessageLoading(conversation, container, participantColors) {
  const messagesArea = container.querySelector('#chatMessagesArea');
  const spinner = container.querySelector('#initialLoadingSpinner');

  const pageSize = 50;
  let currentOffset = 0;
  let isFetching = false;
  let hasMore = true;
  let lastRenderedDateKey = null;

  // Determinar remitente saliente ("outgoing"): el que más mensajes tiene o "Tú"
  const outgoingSender = determineOutgoingSender(conversation.participants);

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

      // Renderizar el bloque de mensajes
      for (const msg of batch) {
        // Separador de fecha si cambia de día
        if (msg.dateKey && msg.dateKey !== lastRenderedDateKey) {
          lastRenderedDateKey = msg.dateKey;
          const dateSeparator = document.createElement('div');
          dateSeparator.className = 'ca-date-separator';
          dateSeparator.textContent = msg.date ? formatDate(msg.date) : msg.rawDate;
          messagesArea.appendChild(dateSeparator);
        }

        const msgRow = await renderMessageRow(msg, outgoingSender, conversation.id, participantColors);
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

  // Escuchar scroll para carga infinita hacia abajo
  messagesArea.addEventListener('scroll', () => {
    const scrollBottom = messagesArea.scrollHeight - messagesArea.scrollTop - messagesArea.clientHeight;
    if (scrollBottom < 150 && hasMore && !isFetching) {
      loadNextBatch();
    }
  });

  // Guardar función en el contenedor para controles de salto
  container._chatLoader = {
    loadAllUntilEnd: async () => {
      while (hasMore) {
        await loadNextBatch();
      }
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }
  };
}

/**
 * Renderiza un mensaje individual (burbuja, adjuntos, metadatos)
 */
async function renderMessageRow(msg, outgoingSender, conversationId, participantColors) {
  const row = document.createElement('div');

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

  const isOutgoing = msg.sender && (msg.sender === outgoingSender || msg.sender.toLowerCase() === 'tú' || msg.sender.toLowerCase() === 'you');
  row.className = `ca-message-row ${isOutgoing ? 'outgoing' : 'incoming'}`;

  const bubble = document.createElement('div');
  bubble.className = `ca-message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`;

  // Nombre de autor si es mensaje entrante (en grupos)
  let authorHtml = '';
  if (!isOutgoing && msg.sender) {
    const color = participantColors[msg.sender] || 'var(--ca-primary)';
    authorHtml = `<div class="ca-message-author" style="color: ${color};">${escapeHTML(msg.sender)}</div>`;
  }

  // Contenido multimedia adjunto si existe
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
      // Consultar Blob en IndexedDB
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
          // Documento u otro archivo
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
        // Archivo no encontrado en IndexedDB
        mediaHtml = `
          <div class="ca-media-missing my-1">
            <i class="bi ${mediaManager.getIconClass(fileName)}" aria-hidden="true"></i>
            <span>${escapeHTML(fileName)} (No disponible en este respaldo)</span>
          </div>
        `;
      }
    }
  }

  // Texto del mensaje
  let textHtml = '';
  if (msg.text && !msg.attachment) {
    textHtml = `<p class="ca-message-text">${escapeHTML(msg.text)}</p>`;
  } else if (msg.text && msg.attachment && msg.text !== msg.attachment.fileName) {
    textHtml = `<p class="ca-message-text mt-1">${escapeHTML(msg.text)}</p>`;
  }

  // Metadatos (Hora)
  const metaHtml = `
    <span class="ca-message-meta">
      <span>${escapeHTML(msg.rawTime || '')}</span>
    </span>
  `;

  bubble.innerHTML = `${authorHtml}${mediaHtml}${textHtml}${metaHtml}`;
  row.appendChild(bubble);

  // Listener para lightbox de imagen
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
 * Configura los botones flotantes de salto y los modales de personalización
 */
function setupViewerControls(conversation, container) {
  const messagesArea = container.querySelector('#chatMessagesArea');
  const btnScrollTop = container.querySelector('#btnScrollToTop');
  const btnScrollBottom = container.querySelector('#btnScrollToBottom');
  const btnCustomizer = container.querySelector('#btnOpenCustomizer');
  const btnInfo = container.querySelector('#btnOpenChatInfo');

  // 1. Ir al primer mensaje
  if (btnScrollTop && messagesArea) {
    btnScrollTop.addEventListener('click', () => {
      messagesArea.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 2. Ir al último mensaje
  if (btnScrollBottom && messagesArea) {
    btnScrollBottom.addEventListener('click', async () => {
      if (container._chatLoader) {
        await container._chatLoader.loadAllUntilEnd();
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

      // Desmarcar hermanos
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
}

function determineOutgoingSender(participants) {
  if (!participants || participants.length === 0) return null;
  // Si alguien se llama "Tú" o "You"
  const you = participants.find(p => p.name.toLowerCase() === 'tú' || p.name.toLowerCase() === 'you');
  if (you) return you.name;

  // En conversaciones 1 a 1, asumir el segundo con más mensajes o el primero
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
