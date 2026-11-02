/**
 * ChatArchive - Vista de Biblioteca de Conversaciones
 * Conectada a IndexedDB con ordenamiento, búsqueda en vivo y borrado en cascada
 */

import { state } from '../core/state.js';
import { formatDate, escapeHTML, showToast } from '../utils/helpers.js';
import { ConversationsRepository } from '../database/conversations.js';

let cachedConversations = [];
let currentFilterText = '';

export async function renderLibrary(container) {
  const currentView = state.viewMode;

  const html = `
    <div class="container-xl py-4">
      <!-- Encabezado de Biblioteca -->
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h1 class="h3 mb-1 fw-bold">Biblioteca de Conversaciones</h1>
          <p class="text-ca-muted mb-0 small">
            Explora, busca y gestiona tus conversaciones archivadas localmente.
          </p>
        </div>
        <div class="d-flex align-items-center gap-2">
          <a href="#import" class="btn btn-ca-primary">
            <i class="bi bi-cloud-arrow-up" aria-hidden="true"></i>
            <span>Importar Chat</span>
          </a>
        </div>
      </div>

      <!-- Barra de Filtros, Búsqueda y Organización -->
      <div class="card bg-ca-surface border-ca shadow-sm rounded-4 mb-4">
        <div class="card-body p-3">
          <div class="row g-2 align-items-center">
            <!-- Buscador por nombre de contacto o grupo -->
            <div class="col-12 col-md-5">
              <div class="input-group">
                <span class="input-group-text bg-transparent border-ca text-ca-muted">
                  <i class="bi bi-search" aria-hidden="true"></i>
                </span>
                <input 
                  type="search" 
                  id="librarySearchInput" 
                  class="form-control bg-transparent border-ca text-ca-main" 
                  placeholder="Buscar por contacto o grupo..."
                  aria-label="Buscar conversaciones"
                  value="${escapeHTML(currentFilterText)}"
                >
              </div>
            </div>

            <!-- Selector de Ordenamiento -->
            <div class="col-7 col-md-4">
              <div class="input-group">
                <label class="input-group-text bg-transparent border-ca text-ca-muted" for="sortSelect">
                  <i class="bi bi-sort-down me-1" aria-hidden="true"></i> Orden
                </label>
                <select id="sortSelect" class="form-select bg-transparent border-ca text-ca-main" aria-label="Ordenar conversaciones por">
                  <option value="recent">Último mensaje</option>
                  <option value="imported">Fecha de importación</option>
                  <option value="name">Nombre (A - Z)</option>
                  <option value="messages">Mayor cantidad de mensajes</option>
                </select>
              </div>
            </div>

            <!-- Alternador de Vista (Cuadrícula / Lista) -->
            <div class="col-5 col-md-3 d-flex justify-content-end gap-1">
              <div class="btn-group" role="group" aria-label="Modo de visualización">
                <button 
                  type="button" 
                  class="btn btn-outline-secondary ${currentView === 'grid' ? 'active' : ''}" 
                  id="btnViewGrid" 
                  title="Vista en cuadrícula"
                  aria-label="Vista en cuadrícula"
                >
                  <i class="bi bi-grid-fill" aria-hidden="true"></i>
                </button>
                <button 
                  type="button" 
                  class="btn btn-outline-secondary ${currentView === 'list' ? 'active' : ''}" 
                  id="btnViewList" 
                  title="Vista en lista"
                  aria-label="Vista en lista"
                >
                  <i class="bi bi-list-ul" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Contenedor Principal de la Biblioteca -->
      <div id="libraryListContainer">
        <div class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando biblioteca...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Confirmación para Eliminar Conversación -->
    <div class="modal fade" id="deleteChatModal" tabindex="-1" aria-labelledby="deleteChatModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header border-ca">
            <div class="d-flex align-items-center gap-2 text-danger">
              <i class="bi bi-exclamation-triangle-fill fs-5" aria-hidden="true"></i>
              <h5 class="modal-title fw-bold" id="deleteChatModalLabel">Eliminar Conversación</h5>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body">
            <p class="mb-2">¿Estás seguro de que deseas eliminar permanentemente la conversación <strong id="deleteTargetTitle"></strong>?</p>
            <div class="p-3 border border-danger-subtle bg-danger-subtle rounded-3 small text-danger mb-0">
              <i class="bi bi-shield-exclamation me-1" aria-hidden="true"></i>
              Esta acción borrará todos sus mensajes y archivos multimedia asociados de tu almacenamiento local IndexedDB. No se puede deshacer.
            </div>
          </div>
          <div class="modal-footer border-ca">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-danger btn-sm" id="btnConfirmDeleteChat">
              <i class="bi bi-trash me-1" aria-hidden="true"></i> Eliminar Definitivamente
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  await loadAndDisplayConversations(container);
  setupLibraryEventListeners(container);
}

/**
 * Carga las conversaciones de IndexedDB y renderiza según filtros y modo de vista
 */
async function loadAndDisplayConversations(container) {
  const sortSelect = container.querySelector('#sortSelect');
  const sortVal = sortSelect?.value || 'recent';

  let sortField = 'lastDate';
  let sortDirection = 'desc';

  if (sortVal === 'name') {
    sortField = 'title';
    sortDirection = 'asc';
  } else if (sortVal === 'messages') {
    sortField = 'messages';
    sortDirection = 'desc';
  } else if (sortVal === 'imported') {
    sortField = 'importedAt';
    sortDirection = 'desc';
  }

  try {
    cachedConversations = await ConversationsRepository.getAll(sortField, sortDirection);
    renderConversationsList(container);
  } catch (err) {
    console.error('[ChatArchive] Error al cargar conversaciones:', err);
    container.querySelector('#libraryListContainer').innerHTML = `
      <div class="alert alert-danger" role="alert">
        <i class="bi bi-exclamation-octagon me-2" aria-hidden="true"></i>
        Error al consultar la base de datos local: ${escapeHTML(err.message)}
      </div>
    `;
  }
}

/**
 * Filtra y renderiza las conversaciones en cuadrícula o lista
 */
function renderConversationsList(container) {
  const listContainer = container.querySelector('#libraryListContainer');
  if (!listContainer) return;

  const currentView = state.viewMode;
  const filter = currentFilterText.trim().toLowerCase();

  const filtered = cachedConversations.filter(c => {
    if (!filter) return true;
    const matchTitle = (c.title || '').toLowerCase().includes(filter);
    const matchParticipants = (c.participants || []).some(p => p.name.toLowerCase().includes(filter));
    return matchTitle || matchParticipants;
  });

  if (filtered.length === 0) {
    if (cachedConversations.length === 0) {
      // Estado vacío inicial
      listContainer.innerHTML = `
        <div class="card bg-ca-surface border-ca shadow-sm rounded-4">
          <div class="card-body p-5 text-center">
            <div class="ca-empty-state py-4">
              <div class="ca-empty-icon">
                <i class="bi bi-archive" aria-hidden="true"></i>
              </div>
              <h3 class="h4 fw-bold mb-2">Tu biblioteca está vacía</h3>
              <p class="text-ca-muted mb-4 mx-auto" style="max-width: 440px;">
                No se encontraron conversaciones guardadas en tu almacenamiento local. Puedes importar tus chats exportados desde WhatsApp en formato ZIP o TXT.
              </p>
              <div class="d-flex justify-content-center gap-2">
                <a href="#import" class="btn btn-ca-primary">
                  <i class="bi bi-cloud-arrow-up" aria-hidden="true"></i>
                  <span>Importar Conversación</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      // Sin coincidencias en la búsqueda
      listContainer.innerHTML = `
        <div class="card bg-ca-surface border-ca shadow-sm rounded-4">
          <div class="card-body p-5 text-center">
            <div class="ca-empty-state py-3">
              <div class="ca-empty-icon">
                <i class="bi bi-search" aria-hidden="true"></i>
              </div>
              <h3 class="h5 fw-bold mb-2">No se encontraron resultados</h3>
              <p class="text-ca-muted mb-3">No hay conversaciones que coincidan con "<strong>${escapeHTML(currentFilterText)}</strong>".</p>
              <button type="button" class="btn btn-sm btn-outline-secondary" id="btnClearSearch">
                <i class="bi bi-x-circle me-1" aria-hidden="true"></i> Limpiar búsqueda
              </button>
            </div>
          </div>
        </div>
      `;
      container.querySelector('#btnClearSearch')?.addEventListener('click', () => {
        const searchInput = container.querySelector('#librarySearchInput');
        if (searchInput) {
          searchInput.value = '';
          currentFilterText = '';
          renderConversationsList(container);
        }
      });
    }
    return;
  }

  if (currentView === 'grid') {
    // Renderizado en Cuadrícula (Cards)
    const cardsHtml = filtered.map(c => `
      <div class="col-12 col-md-6 col-xl-4">
        <div class="ca-chat-card h-100 d-flex flex-column justify-content-between">
          <div>
            <div class="d-flex align-items-start justify-content-between gap-2 mb-3">
              <div class="d-flex align-items-center gap-3 min-w-0">
                <div class="ca-chat-avatar flex-shrink-0">
                  <i class="bi bi-chat-dots" aria-hidden="true"></i>
                </div>
                <div class="text-truncate">
                  <h3 class="h6 mb-1 fw-bold text-truncate text-ca-main" title="${escapeHTML(c.title)}">
                    ${escapeHTML(c.title)}
                  </h3>
                  <span class="badge ca-badge-soft-success">
                    <i class="bi bi-chat-left-text me-1" aria-hidden="true"></i>${c.totalMessages.toLocaleString()} msgs
                  </span>
                </div>
              </div>
              <div class="dropdown">
                <button 
                  class="btn btn-sm btn-icon-only btn-outline-secondary border-0" 
                  type="button" 
                  data-bs-toggle="dropdown" 
                  aria-expanded="false"
                  title="Opciones de conversación"
                  aria-label="Opciones de conversación"
                >
                  <i class="bi bi-three-dots-vertical" aria-hidden="true"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow border-ca">
                  <li>
                    <a class="dropdown-item d-flex align-items-center gap-2" href="#chat?id=${c.id}">
                      <i class="bi bi-box-arrow-in-right text-primary" aria-hidden="true"></i> Abrir visor
                    </a>
                  </li>
                  <li><hr class="dropdown-divider border-ca"></li>
                  <li>
                    <button class="dropdown-item d-flex align-items-center gap-2 text-danger btn-delete-chat" data-chat-id="${c.id}" data-chat-title="${escapeHTML(c.title)}">
                      <i class="bi bi-trash" aria-hidden="true"></i> Eliminar conversación
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <div class="small text-ca-muted mb-3 d-flex flex-column gap-1">
              <div>
                <i class="bi bi-calendar3 me-1" aria-hidden="true"></i>
                <span>${c.firstDate ? formatDate(c.firstDate) : 'Inicio'} — ${c.lastDate ? formatDate(c.lastDate) : 'Fin'}</span>
              </div>
              <div>
                <i class="bi bi-people me-1" aria-hidden="true"></i>
                <span>${(c.participants || []).length} participante(s)</span>
              </div>
              ${c.mediaCount > 0 ? `
                <div>
                  <i class="bi bi-paperclip me-1" aria-hidden="true"></i>
                  <span>${c.mediaCount} archivo(s) multimedia</span>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="pt-2 border-top border-ca d-flex justify-content-between align-items-center">
            <small class="text-ca-muted">Importado: ${c.importedAt ? formatDate(c.importedAt) : ''}</small>
            <a href="#chat?id=${c.id}" class="btn btn-sm btn-ca-primary">
              <span>Abrir</span>
              <i class="bi bi-arrow-right" aria-hidden="true"></i>
            </a>
          </div>
        </div>
      </div>
    `).join('');

    listContainer.innerHTML = `<div class="row g-3">${cardsHtml}</div>`;
  } else {
    // Renderizado en Lista Compacta
    const rowsHtml = filtered.map(c => `
      <div class="list-group-item bg-ca-surface border-ca p-3 d-flex align-items-center justify-content-between gap-3">
        <div class="d-flex align-items-center gap-3 min-w-0">
          <div class="ca-chat-avatar flex-shrink-0">
            <i class="bi bi-chat-dots" aria-hidden="true"></i>
          </div>
          <div class="text-truncate">
            <h3 class="h6 mb-0 fw-bold text-truncate text-ca-main">${escapeHTML(c.title)}</h3>
            <div class="small text-ca-muted d-flex flex-wrap gap-2 mt-1">
              <span><i class="bi bi-chat-left-text me-1" aria-hidden="true"></i>${c.totalMessages.toLocaleString()} msgs</span>
              <span>•</span>
              <span><i class="bi bi-calendar3 me-1" aria-hidden="true"></i>${c.lastDate ? formatDate(c.lastDate) : ''}</span>
            </div>
          </div>
        </div>

        <div class="d-flex align-items-center gap-2 flex-shrink-0">
          <a href="#chat?id=${c.id}" class="btn btn-sm btn-outline-secondary" title="Abrir visor" aria-label="Abrir visor">
            <i class="bi bi-box-arrow-in-right me-1" aria-hidden="true"></i> Abrir
          </a>
          <button 
            type="button" 
            class="btn btn-sm btn-outline-danger btn-icon-only btn-delete-chat" 
            data-chat-id="${c.id}" 
            data-chat-title="${escapeHTML(c.title)}"
            title="Eliminar conversación"
            aria-label="Eliminar conversación"
          >
            <i class="bi bi-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    `).join('');

    listContainer.innerHTML = `<div class="list-group list-group-flush rounded-4 shadow-sm border border-ca overflow-hidden">${rowsHtml}</div>`;
  }

  setupDeleteHandlers(container);
}

/**
 * Configura los eventos de interacción (búsqueda, orden, eliminación)
 */
function setupLibraryEventListeners(container) {
  const searchInput = container.querySelector('#librarySearchInput');
  const sortSelect = container.querySelector('#sortSelect');
  const btnGrid = container.querySelector('#btnViewGrid');
  const btnList = container.querySelector('#btnViewList');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentFilterText = e.target.value;
      renderConversationsList(container);
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      loadAndDisplayConversations(container);
    });
  }

  if (btnGrid && btnList) {
    btnGrid.addEventListener('click', () => {
      btnGrid.classList.add('active');
      btnList.classList.remove('active');
      state.setViewMode('grid');
      renderConversationsList(container);
    });
    btnList.addEventListener('click', () => {
      btnList.classList.add('active');
      btnGrid.classList.remove('active');
      state.setViewMode('list');
      renderConversationsList(container);
    });
  }
}

/**
 * Configura el modal de eliminación y ejecuta el borrado en cascada
 */
function setupDeleteHandlers(container) {
  let targetChatId = null;
  const modalEl = container.querySelector('#deleteChatModal');
  const confirmBtn = container.querySelector('#btnConfirmDeleteChat');

  container.querySelectorAll('.btn-delete-chat').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      targetChatId = btn.getAttribute('data-chat-id');
      const chatTitle = btn.getAttribute('data-chat-title');
      container.querySelector('#deleteTargetTitle').textContent = `"${chatTitle}"`;

      if (window.bootstrap && window.bootstrap.Modal) {
        const modal = new window.bootstrap.Modal(modalEl);
        modal.show();
      }
    });
  });

  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      if (!targetChatId) return;

      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Eliminando...';

      try {
        await ConversationsRepository.delete(targetChatId);

        // Ocultar modal
        if (window.bootstrap && window.bootstrap.Modal) {
          const modalInstance = window.bootstrap.Modal.getInstance(modalEl);
          modalInstance?.hide();
        }

        // Actualizar estadísticas globales
        const globalStats = await ConversationsRepository.getGlobalStats();
        state.stats.totalConversations = globalStats.totalConversations;
        state.stats.totalMessages = globalStats.totalMessages;
        state.stats.totalMediaFiles = globalStats.totalMedia;
        await state.updateStorageEstimate();
        state.notify();

        showToast('Conversación Eliminada', 'Se ha eliminado la conversación y todos sus archivos asociados.', 'success');

        // Recargar vista
        await loadAndDisplayConversations(container);
      } catch (err) {
        console.error('[ChatArchive] Error al eliminar conversación:', err);
        showToast('Error', 'No se pudo eliminar la conversación: ' + err.message, 'danger');
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="bi bi-trash me-1" aria-hidden="true"></i> Eliminar Definitivamente';
        targetChatId = null;
      }
    };
  }
}
