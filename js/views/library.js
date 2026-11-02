/**
 * ChatArchive - Vista de Biblioteca de Conversaciones
 */

import { state } from '../core/state.js';

export function renderLibrary(container) {
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
        <!-- Estado Vacío Inicial -->
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
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Listeners para selector de vista
  const btnGrid = container.querySelector('#btnViewGrid');
  const btnList = container.querySelector('#btnViewList');
  if (btnGrid && btnList) {
    btnGrid.addEventListener('click', () => {
      btnGrid.classList.add('active');
      btnList.classList.remove('active');
      state.setViewMode('grid');
    });
    btnList.addEventListener('click', () => {
      btnList.classList.add('active');
      btnGrid.classList.remove('active');
      state.setViewMode('list');
    });
  }
}
