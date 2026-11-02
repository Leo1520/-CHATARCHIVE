/**
 * ChatArchive - Buscador Avanzado y Navegación entre Mensajes
 * Integración con Web Worker, normalización diacrítica y saltos con resaltado visual
 */

import { MessagesRepository } from '../database/messages.js';
import { escapeHTML } from '../utils/helpers.js';

export class ChatSearchController {
  constructor(conversation, chatViewerContext) {
    this.conversation = conversation;
    this.context = chatViewerContext;
    this.searchWorker = null;
    this.allMessagesCache = null;
    this.matches = [];
    this.currentMatchIndex = -1;
    this.debounceTimer = null;
    this.isSearching = false;

    this.initWorker();
  }

  initWorker() {
    try {
      this.searchWorker = new Worker('./workers/search-worker.js');
      this.searchWorker.onmessage = (e) => {
        const { type, results, total } = e.data || {};
        if (type === 'complete') {
          this.handleSearchResults(results || []);
        }
      };
    } catch (err) {
      console.warn('[ChatArchive] Worker de búsqueda no disponible, usando fallback síncrono:', err);
      this.searchWorker = null;
    }
  }

  /**
   * Abre o cierra la barra de búsqueda en la cabecera del visor
   */
  toggleSearchBar() {
    const searchBar = document.getElementById('chatSearchBar');
    const searchInput = document.getElementById('chatSearchInput');

    if (!searchBar) return;

    if (searchBar.classList.contains('d-none')) {
      searchBar.classList.remove('d-none');
      searchInput?.focus();
    } else {
      this.closeSearch();
    }
  }

  /**
   * Cierra el buscador y limpia resaltados
   */
  closeSearch() {
    const searchBar = document.getElementById('chatSearchBar');
    const searchInput = document.getElementById('chatSearchInput');

    if (searchBar) searchBar.classList.add('d-none');
    if (searchInput) searchInput.value = '';

    this.matches = [];
    this.currentMatchIndex = -1;
    this.updateCounterBadge();
    this.clearHighlights();
  }

  /**
   * Ejecuta la búsqueda con debounce para rendimiento óptimo
   */
  onSearchInput(query) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.performSearch(query);
    }, 250);
  }

  async performSearch(query) {
    const cleanQuery = (query || '').trim();

    if (!cleanQuery) {
      this.matches = [];
      this.currentMatchIndex = -1;
      this.updateCounterBadge();
      this.clearHighlights();
      this.renderResultsList();
      return;
    }

    this.setSearchingState(true);

    // Cargar caché de todos los mensajes de la conversación si no existe
    if (!this.allMessagesCache) {
      this.allMessagesCache = await MessagesRepository.getAllMessagesByConversation(this.conversation.id);
    }

    if (this.searchWorker) {
      this.searchWorker.postMessage({
        action: 'search',
        query: cleanQuery,
        messages: this.allMessagesCache
      });
    } else {
      // Fallback síncrono si los Workers fallan
      const results = this.syncSearchFallback(cleanQuery, this.allMessagesCache);
      this.handleSearchResults(results);
    }
  }

  syncSearchFallback(query, messages) {
    const normQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const results = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.type === 'system' || !msg.text) continue;

      const normText = msg.text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normText.includes(normQuery)) {
        results.push({
          id: msg.id,
          index: msg.index !== undefined ? msg.index : i,
          sender: msg.sender,
          text: msg.text,
          rawTime: msg.rawTime,
          snippet: msg.text.substring(0, 100)
        });
      }
    }
    return results;
  }

  handleSearchResults(results) {
    this.setSearchingState(false);
    this.matches = results;

    if (this.matches.length > 0) {
      this.currentMatchIndex = 0;
      this.jumpToMatch(0);
    } else {
      this.currentMatchIndex = -1;
    }

    this.updateCounterBadge();
    this.renderResultsList();
  }

  setSearchingState(isSearching) {
    this.isSearching = isSearching;
    const spinner = document.getElementById('searchSpinner');
    const badge = document.getElementById('searchCounterBadge');
    if (spinner && badge) {
      if (isSearching) {
        spinner.classList.remove('d-none');
        badge.classList.add('d-none');
      } else {
        spinner.classList.add('d-none');
        badge.classList.remove('d-none');
      }
    }
  }

  updateCounterBadge() {
    const badge = document.getElementById('searchCounterBadge');
    const btnPrev = document.getElementById('btnSearchPrev');
    const btnNext = document.getElementById('btnSearchNext');

    if (!badge) return;

    if (this.matches.length === 0) {
      badge.textContent = '0 resultados';
      if (btnPrev) btnPrev.disabled = true;
      if (btnNext) btnNext.disabled = true;
    } else {
      badge.textContent = `${this.currentMatchIndex + 1} de ${this.matches.length}`;
      if (btnPrev) btnPrev.disabled = false;
      if (btnNext) btnNext.disabled = false;
    }
  }

  nextMatch() {
    if (this.matches.length === 0) return;
    this.currentMatchIndex = (this.currentMatchIndex + 1) % this.matches.length;
    this.jumpToMatch(this.currentMatchIndex);
    this.updateCounterBadge();
  }

  prevMatch() {
    if (this.matches.length === 0) return;
    this.currentMatchIndex = (this.currentMatchIndex - 1 + this.matches.length) % this.matches.length;
    this.jumpToMatch(this.currentMatchIndex);
    this.updateCounterBadge();
  }

  /**
   * Salta al mensaje coincidente, garantizando que esté en el DOM y aplicándole el foco con animación
   * @param {number} matchIdx Índice en el array de coincidencias
   */
  async jumpToMatch(matchIdx) {
    const match = this.matches[matchIdx];
    if (!match) return;

    const messagesArea = document.getElementById('chatMessagesArea');
    if (!messagesArea) return;

    this.clearHighlights();

    // 1. Buscar si el elemento ya está renderizado en el DOM
    let targetEl = messagesArea.querySelector(`[data-msg-index="${match.index}"]`);

    if (!targetEl) {
      // 2. Si no está en el DOM, cargar el bloque de mensajes alrededor de ese índice
      await this.context.loadChunkAroundIndex(match.index);
      targetEl = messagesArea.querySelector(`[data-msg-index="${match.index}"]`);
    }

    if (targetEl) {
      // Desplazamiento suave y centrado
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Aplicar animación de resaltado
      const bubble = targetEl.querySelector('.ca-message-bubble') || targetEl;
      bubble.classList.add('ca-message-highlight');

      setTimeout(() => {
        bubble.classList.remove('ca-message-highlight');
      }, 3500);
    }
  }

  clearHighlights() {
    document.querySelectorAll('.ca-message-highlight').forEach(el => {
      el.classList.remove('ca-message-highlight');
    });
  }

  /**
   * Renderiza el panel Offcanvas de resultados detallados
   */
  renderResultsList() {
    const listContainer = document.getElementById('searchResultsOffcanvasList');
    if (!listContainer) return;

    if (this.matches.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-4 text-ca-muted small">
          <i class="bi bi-search fs-3 d-block mb-2" aria-hidden="true"></i>
          Ingresa un término para buscar mensajes en esta conversación.
        </div>
      `;
      return;
    }

    const items = this.matches.map((m, idx) => `
      <div 
        class="list-group-item bg-transparent border-ca p-3 cursor-pointer search-result-item ${idx === this.currentMatchIndex ? 'bg-ca-elevated border-primary' : ''}" 
        data-match-idx="${idx}"
        role="button"
        tabindex="0"
      >
        <div class="d-flex justify-content-between align-items-center mb-1">
          <strong class="text-primary small">${escapeHTML(m.sender || 'Remitente')}</strong>
          <span class="text-ca-muted" style="font-size: 0.725rem;">${escapeHTML(m.rawTime || '')}</span>
        </div>
        <p class="mb-0 small text-ca-main text-truncate-2">${escapeHTML(m.snippet)}</p>
      </div>
    `).join('');

    listContainer.innerHTML = `<div class="list-group list-group-flush border-ca rounded-3">${items}</div>`;

    // Listeners para hacer clic en un resultado de la lista
    listContainer.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.getAttribute('data-match-idx'), 10);
        this.currentMatchIndex = idx;
        this.jumpToMatch(idx);
        this.updateCounterBadge();

        // Cerrar offcanvas si está en móvil
        const offcanvasEl = document.getElementById('searchResultsOffcanvas');
        if (offcanvasEl && window.bootstrap && window.bootstrap.Offcanvas) {
          const instance = window.bootstrap.Offcanvas.getInstance(offcanvasEl);
          instance?.hide();
        }
      });
    });
  }

  destroy() {
    if (this.searchWorker) {
      this.searchWorker.terminate();
      this.searchWorker = null;
    }
  }
}
