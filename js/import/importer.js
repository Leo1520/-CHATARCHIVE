/**
 * ChatArchive - Vista y Controlador Inicial de Importación
 */

import { showToast } from '../utils/helpers.js';

export function renderImporterView(container) {
  const html = `
    <div class="container-xl py-4">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-10 col-xl-9">
          <!-- Encabezado de Importación -->
          <div class="mb-4">
            <h1 class="h3 mb-1 fw-bold">Importar Conversación</h1>
            <p class="text-ca-muted mb-0 small">
              Selecciona o arrastra el archivo exportado desde WhatsApp (.zip o .txt) para archivarlo en tu dispositivo.
            </p>
          </div>

          <!-- Zona Drag & Drop -->
          <div class="card bg-ca-surface border-ca shadow-sm rounded-4 mb-4">
            <div class="card-body p-4 p-md-5">
              <div class="ca-dropzone" id="fileDropzone" tabindex="0" role="button" aria-label="Zona para arrastrar o seleccionar archivos de chat">
                <input 
                  type="file" 
                  id="chatFileInput" 
                  class="d-none" 
                  accept=".zip,.txt" 
                  multiple
                >
                <div class="ca-dropzone-icon">
                  <i class="bi bi-cloud-arrow-up" aria-hidden="true"></i>
                </div>
                <h2 class="h5 fw-bold mb-2">Arrastra tu archivo ZIP o TXT aquí</h2>
                <p class="text-ca-muted small mb-3">
                  Soporta chats exportados con o sin archivos multimedia adjuntos.
                </p>
                <button type="button" class="btn btn-ca-primary" id="btnSelectFiles">
                  <i class="bi bi-folder2-open" aria-hidden="true"></i>
                  <span>Seleccionar Archivos</span>
                </button>
                <div class="mt-3 small text-ca-muted">
                  <i class="bi bi-shield-check text-success me-1" aria-hidden="true"></i>
                  Procesamiento local e instantáneo en tu navegador
                </div>
              </div>

              <!-- Lista de Archivos Seleccionados (Placeholder interactivo) -->
              <div id="selectedFilesArea" class="mt-4 d-none">
                <h3 class="h6 fw-bold mb-3 d-flex align-items-center gap-2">
                  <i class="bi bi-files text-ca-muted" aria-hidden="true"></i>
                  <span>Archivos detectados</span>
                </h3>
                <div class="list-group list-group-flush border-ca rounded-3" id="fileListPreview"></div>
              </div>
            </div>
          </div>

          <!-- Guía de Exportación de WhatsApp (Android / iOS) -->
          <div class="card bg-ca-surface border-ca shadow-sm rounded-4">
            <div class="card-header bg-transparent border-ca py-3 px-4">
              <h2 class="h6 mb-0 fw-bold d-flex align-items-center gap-2">
                <i class="bi bi-info-circle text-ca-muted" aria-hidden="true"></i>
                <span>¿Cómo exportar tus conversaciones desde WhatsApp?</span>
              </h2>
            </div>
            <div class="card-body p-4">
              <ul class="nav nav-pills mb-3" id="guideTabs" role="tablist">
                <li class="nav-item" role="presentation">
                  <button 
                    class="nav-link active rounded-pill px-3 py-1 small" 
                    id="android-tab" 
                    data-bs-toggle="pill" 
                    data-bs-target="#android-guide" 
                    type="button" 
                    role="tab"
                    aria-controls="android-guide"
                    aria-selected="true"
                  >
                    <i class="bi bi-phone me-1" aria-hidden="true"></i> Android
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button 
                    class="nav-link rounded-pill px-3 py-1 small" 
                    id="ios-tab" 
                    data-bs-toggle="pill" 
                    data-bs-target="#ios-guide" 
                    type="button" 
                    role="tab"
                    aria-controls="ios-guide"
                    aria-selected="false"
                  >
                    <i class="bi bi-apple me-1" aria-hidden="true"></i> iPhone (iOS)
                  </button>
                </li>
              </ul>

              <div class="tab-content" id="guideTabsContent">
                <!-- Guía Android -->
                <div class="tab-pane fade show active" id="android-guide" role="tabpanel" aria-labelledby="android-tab">
                  <ol class="small text-ca-muted ps-3 mb-0 d-flex flex-column gap-2">
                    <li>Abre WhatsApp y entra a la conversación individual o grupal que desees exportar.</li>
                    <li>Toca el menú de <strong>tres puntos</strong> en la esquina superior derecha y selecciona <strong>Más</strong>.</li>
                    <li>Elige <strong>Exportar chat</strong>.</li>
                    <li>Selecciona <strong>"Incluir archivos"</strong> (para guardar fotos, audios y documentos) o <strong>"Sin archivos"</strong> (solo mensajes de texto).</li>
                    <li>Guarda el archivo resultante (<code>.zip</code> o <code>.txt</code>) en tu almacenamiento o transfiérelo a este dispositivo.</li>
                  </ol>
                </div>

                <!-- Guía iOS -->
                <div class="tab-pane fade" id="ios-guide" role="tabpanel" aria-labelledby="ios-tab">
                  <ol class="small text-ca-muted ps-3 mb-0 d-flex flex-column gap-2">
                    <li>Abre WhatsApp y entra al chat individual o grupal.</li>
                    <li>Toca el <strong>nombre del contacto o grupo</strong> en la parte superior.</li>
                    <li>Baja hasta encontrar la opción <strong>Exportar chat</strong>.</li>
                    <li>Elige si deseas exportar con o sin archivos multimedia.</li>
                    <li>Usa <strong>"Guardar en Archivos"</strong> o comparte el archivo ZIP a tu equipo para abrirlo con ChatArchive.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Interacción inicial de la dropzone para la etapa 1
  const dropzone = container.querySelector('#fileDropzone');
  const fileInput = container.querySelector('#chatFileInput');
  const btnSelect = container.querySelector('#btnSelectFiles');

  if (dropzone && fileInput && btnSelect) {
    btnSelect.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    dropzone.addEventListener('click', () => {
      fileInput.click();
    });

    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-active');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleFileSelection(files, container);
      }
    });

    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelection(files, container);
      }
    });
  }
}

function handleFileSelection(files, container) {
  const selectedArea = container.querySelector('#selectedFilesArea');
  const previewList = container.querySelector('#fileListPreview');
  if (!selectedArea || !previewList) return;

  selectedArea.classList.remove('d-none');
  previewList.innerHTML = '';

  Array.from(files).forEach(file => {
    const isZip = file.name.endsWith('.zip');
    const isTxt = file.name.endsWith('.txt');
    const iconClass = isZip ? 'bi-file-earmark-zip text-warning' : (isTxt ? 'bi-file-earmark-text text-info' : 'bi-file-earmark text-muted');

    const item = document.createElement('div');
    item.className = 'list-group-item bg-transparent border-ca d-flex align-items-center justify-content-between p-3';
    item.innerHTML = `
      <div class="d-flex align-items-center gap-3">
        <i class="bi ${iconClass} fs-4" aria-hidden="true"></i>
        <div>
          <div class="fw-semibold text-ca-main">${file.name}</div>
          <small class="text-ca-muted">${(file.size / 1024).toFixed(1)} KB</small>
        </div>
      </div>
      <span class="badge ca-badge-soft-success">Listo para Etapa 2</span>
    `;
    previewList.appendChild(item);
  });

  showToast(
    'Archivos Recibidos',
    `Se han detectado ${files.length} archivo(s). En la Etapa 2 se ejecutará la lectura del ZIP y el parser modular.`,
    'info'
  );
}
