import { ZipReader, deduceChatTitle } from './zip-reader.js';
import { readTextFile } from './txt-reader.js';
import { WhatsAppParser } from './parser.js';
import { mediaManager } from './media-handler.js';
import { formatDate, escapeHTML, showToast } from '../utils/helpers.js';
import { ConversationsRepository } from '../database/conversations.js';
import { MessagesRepository } from '../database/messages.js';
import { state } from '../core/state.js';

let lastParsedPayload = null;

export function renderImporterView(container) {
  const html = `
    <div class="container-xl py-4">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-10 col-xl-9">
          <!-- Encabezado de Importación -->
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
            <div>
              <h1 class="h3 mb-1 fw-bold">Importar Conversación</h1>
              <p class="text-ca-muted mb-0 small">
                Procesa y analiza tus archivos exportados de WhatsApp (.zip o .txt) de forma 100% local.
              </p>
            </div>
            <a href="#library" class="btn btn-outline-secondary btn-sm">
              <i class="bi bi-collection me-1" aria-hidden="true"></i> Ir a Biblioteca
            </a>
          </div>

          <!-- Zona Drag & Drop -->
          <div class="card bg-ca-surface border-ca shadow-sm rounded-4 mb-4" id="importMainCard">
            <div class="card-body p-4 p-md-5">
              <div class="ca-dropzone" id="fileDropzone" tabindex="0" role="button" aria-label="Zona para arrastrar o seleccionar archivos de chat">
                <input 
                  type="file" 
                  id="chatFileInput" 
                  class="d-none" 
                  accept=".zip,.txt" 
                >
                <div class="ca-dropzone-icon">
                  <i class="bi bi-cloud-arrow-up" aria-hidden="true"></i>
                </div>
                <h2 class="h5 fw-bold mb-2">Arrastra tu archivo ZIP o TXT aquí</h2>
                <p class="text-ca-muted small mb-3">
                  Soporta chats exportados de Android y iPhone, con o sin archivos multimedia adjuntos.
                </p>
                <button type="button" class="btn btn-ca-primary" id="btnSelectFiles">
                  <i class="bi bi-folder2-open" aria-hidden="true"></i>
                  <span>Seleccionar Archivo</span>
                </button>
                <div class="mt-3 small text-ca-muted">
                  <i class="bi bi-shield-check text-success me-1" aria-hidden="true"></i>
                  Tus datos se procesan en tu memoria local y nunca salen de este equipo
                </div>
              </div>

              <!-- Barra de Progreso Dinámica -->
              <div id="importProgressArea" class="mt-4 d-none">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <span class="small fw-semibold text-ca-main" id="progressStatusText">Iniciando procesamiento...</span>
                  <span class="small fw-bold text-primary" id="progressPercentText">0%</span>
                </div>
                <div class="progress" style="height: 10px;">
                  <div 
                    id="importProgressBar" 
                    class="progress-bar progress-bar-striped progress-bar-animated bg-success" 
                    role="progressbar" 
                    style="width: 0%;" 
                    aria-valuenow="0" 
                    aria-valuemin="0" 
                    aria-valuemax="100"
                  ></div>
                </div>
              </div>

              <!-- Resumen del Chat Procesado con Previsualización -->
              <div id="importResultsArea" class="mt-4 d-none">
                <div class="p-3 p-md-4 border border-ca rounded-4 bg-ca-elevated">
                  <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-3 border-bottom border-ca">
                    <div class="d-flex align-items-center gap-3">
                      <div class="ca-chat-avatar">
                        <i class="bi bi-chat-dots" aria-hidden="true"></i>
                      </div>
                      <div>
                        <h2 class="h5 fw-bold mb-1" id="resChatTitle">Conversación</h2>
                        <span class="badge ca-badge-soft-success" id="resTotalMsgsBadge">0 mensajes</span>
                      </div>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                      <button type="button" class="btn btn-sm btn-outline-secondary" id="btnResetImport">
                        <i class="bi bi-arrow-repeat me-1" aria-hidden="true"></i> Otro archivo
                      </button>
                      <button type="button" class="btn btn-sm btn-ca-primary" id="btnSaveToDatabase">
                        <i class="bi bi-check-circle me-1" aria-hidden="true"></i> Confirmar y Guardar
                      </button>
                    </div>
                  </div>

                  <!-- Métricas del Chat -->
                  <div class="row g-3 mb-4">
                    <div class="col-12 col-sm-4">
                      <div class="p-2 border border-ca rounded-3 bg-ca-surface text-center">
                        <small class="text-ca-muted d-block">Participantes</small>
                        <strong class="fs-5" id="resParticipantsCount">0</strong>
                      </div>
                    </div>
                    <div class="col-12 col-sm-4">
                      <div class="p-2 border border-ca rounded-3 bg-ca-surface text-center">
                        <small class="text-ca-muted d-block">Archivos Multimedia</small>
                        <strong class="fs-5" id="resMediaCount">0</strong>
                      </div>
                    </div>
                    <div class="col-12 col-sm-4">
                      <div class="p-2 border border-ca rounded-3 bg-ca-surface text-center">
                        <small class="text-ca-muted d-block">Rango de Fechas</small>
                        <span class="small fw-semibold d-block mt-1" id="resDateRange">-</span>
                      </div>
                    </div>
                  </div>

                  <!-- Desglose de Participantes -->
                  <div class="mb-4">
                    <h3 class="h6 fw-bold mb-2 d-flex align-items-center gap-2">
                      <i class="bi bi-people text-ca-muted" aria-hidden="true"></i>
                      <span>Participantes identificados</span>
                    </h3>
                    <div class="d-flex flex-wrap gap-2" id="resParticipantsList"></div>
                  </div>

                  <!-- Previsualización de Mensajes -->
                  <div>
                    <h3 class="h6 fw-bold mb-3 d-flex align-items-center gap-2">
                      <i class="bi bi-eye text-ca-muted" aria-hidden="true"></i>
                      <span>Muestra preliminar de mensajes</span>
                    </h3>
                    <div class="p-3 border border-ca rounded-3 bg-ca-surface" style="max-height: 280px; overflow-y: auto;" id="resPreviewMessages"></div>
                  </div>
                </div>
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
                <div class="tab-pane fade show active" id="android-guide" role="tabpanel" aria-labelledby="android-tab">
                  <ol class="small text-ca-muted ps-3 mb-0 d-flex flex-column gap-2">
                    <li>Abre WhatsApp y entra a la conversación individual o grupal que desees exportar.</li>
                    <li>Toca el menú de <strong>tres puntos</strong> en la esquina superior derecha y selecciona <strong>Más</strong>.</li>
                    <li>Elige <strong>Exportar chat</strong>.</li>
                    <li>Selecciona <strong>"Incluir archivos"</strong> (para guardar fotos, audios y documentos) o <strong>"Sin archivos"</strong> (solo texto).</li>
                    <li>Guarda el archivo resultante (<code>.zip</code> o <code>.txt</code>) y arrástralo aquí.</li>
                  </ol>
                </div>

                <div class="tab-pane fade" id="ios-guide" role="tabpanel" aria-labelledby="ios-tab">
                  <ol class="small text-ca-muted ps-3 mb-0 d-flex flex-column gap-2">
                    <li>Abre WhatsApp y entra al chat correspondiente.</li>
                    <li>Toca el <strong>nombre del contacto o grupo</strong> en la parte superior.</li>
                    <li>Baja hasta encontrar la opción <strong>Exportar chat</strong>.</li>
                    <li>Elige si deseas exportar con o sin archivos multimedia adjuntos.</li>
                    <li>Usa <strong>"Guardar en Archivos"</strong> o transfiérelo a este equipo para abrirlo con ChatArchive.</li>
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
  setupImporterInteractions(container);
}

function setupImporterInteractions(container) {
  const dropzone = container.querySelector('#fileDropzone');
  const fileInput = container.querySelector('#chatFileInput');
  const btnSelect = container.querySelector('#btnSelectFiles');

  if (!dropzone || !fileInput || !btnSelect) return;

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
      processSelectedFile(files[0], container);
    }
  });

  fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0], container);
    }
  });

  // Botón para procesar otro archivo
  const btnReset = container.querySelector('#btnResetImport');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      container.querySelector('#importResultsArea')?.classList.add('d-none');
      container.querySelector('#fileDropzone')?.classList.remove('d-none');
      fileInput.value = '';
    });
  }

  // Botón de guardar en base de datos
  const btnSave = container.querySelector('#btnSaveToDatabase');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      if (!lastParsedPayload) {
        showToast('Error', 'No hay datos de conversación para guardar.', 'warning');
        return;
      }

      btnSave.disabled = true;
      btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Guardando...';

      try {
        const payload = lastParsedPayload;

        // Comprobar posible duplicado
        const duplicate = await ConversationsRepository.findPotentialDuplicate(payload.title, payload.lastDate);
        if (duplicate) {
          const proceed = window.confirm(`Ya existe una conversación archivada con el nombre "${payload.title}" y fecha similar.\n\n¿Deseas guardarla de todas formas como una nueva copia?`);
          if (!proceed) {
            btnSave.disabled = false;
            btnSave.innerHTML = '<i class="bi bi-check-circle me-1" aria-hidden="true"></i> Confirmar y Guardar';
            return;
          }
        }

        const convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        // 1. Guardar metadatos de la conversación
        await ConversationsRepository.save({
          id: convId,
          title: payload.title,
          participants: payload.participants,
          totalMessages: payload.totalMessages,
          mediaCount: payload.mediaCount,
          firstDate: payload.firstDate ? payload.firstDate.toISOString() : null,
          lastDate: payload.lastDate ? payload.lastDate.toISOString() : null,
          importedAt: new Date().toISOString()
        });

        // 2. Guardar los mensajes en lote
        await MessagesRepository.bulkSaveMessages(convId, payload.messages);

        // 3. Guardar los archivos multimedia en Blob
        if (mediaManager.mediaBlobs.size > 0) {
          await MessagesRepository.saveMediaFiles(convId, mediaManager.mediaBlobs);
        }

        // 4. Actualizar estado global y almacenamiento
        await state.updateStorageEstimate();
        const globalStats = await ConversationsRepository.getGlobalStats();
        state.stats = {
          totalConversations: globalStats.totalConversations,
          totalMessages: globalStats.totalMessages,
          totalMediaFiles: globalStats.totalMedia,
          totalStorageBytes: state.storageEstimate.usage
        };
        state.notify();

        showToast(
          '¡Conversación Guardada!',
          `Se han almacenado con éxito ${payload.totalMessages.toLocaleString()} mensajes y ${payload.mediaCount} archivos en tu almacenamiento local.`,
          'success'
        );

        // Redirigir a la Biblioteca
        window.location.hash = '#library';
      } catch (err) {
        console.error('[ChatArchive] Error al guardar en IndexedDB:', err);
        btnSave.disabled = false;
        btnSave.innerHTML = '<i class="bi bi-check-circle me-1" aria-hidden="true"></i> Confirmar y Guardar';
        showToast('Error de Almacenamiento', err.message || 'No se pudo guardar la conversación en la base de datos.', 'danger');
      }
    });
  }
}

/**
 * Procesa el archivo seleccionado (ZIP o TXT) mediante lectura y parseo
 */
async function processSelectedFile(file, container) {
  const dropzone = container.querySelector('#fileDropzone');
  const progressArea = container.querySelector('#importProgressArea');
  const progressBar = container.querySelector('#importProgressBar');
  const progressStatus = container.querySelector('#progressStatusText');
  const progressPercent = container.querySelector('#progressPercentText');
  const resultsArea = container.querySelector('#importResultsArea');

  if (!file) return;

  const fileName = file.name.toLowerCase();
  const isZip = fileName.endsWith('.zip');
  const isTxt = fileName.endsWith('.txt');

  if (!isZip && !isTxt) {
    showToast('Formato No Válido', 'Por favor selecciona un archivo con extensión .zip o .txt de WhatsApp.', 'danger');
    return;
  }

  // Mostrar área de progreso
  dropzone.classList.add('d-none');
  progressArea.classList.remove('d-none');
  resultsArea.classList.add('d-none');

  const updateProgress = (percent, message) => {
    progressBar.style.width = `${percent}%`;
    progressBar.setAttribute('aria-valuenow', percent);
    progressPercent.textContent = `${percent}%`;
    progressStatus.textContent = message;
  };

  try {
    let chatText = '';
    let chatTitle = '';
    let mediaCount = 0;

    if (isZip) {
      updateProgress(10, 'Leyendo archivo ZIP...');
      const zipData = await ZipReader.readZip(file, (pct, msg) => {
        updateProgress(pct, msg);
      });
      chatText = zipData.chatText;
      chatTitle = zipData.chatTitle;
      mediaCount = zipData.mediaCount;
    } else {
      updateProgress(20, 'Leyendo archivo de texto...');
      chatText = await readTextFile(file);
      chatTitle = deduceChatTitle(file.name, file.name);
    }

    updateProgress(85, 'Interpretando mensajes y participantes...');
    const parsedData = WhatsAppParser.parse(chatText, (pct, msg) => {
      const scaledPct = Math.round(85 + (pct * 0.15));
      updateProgress(scaledPct, msg);
    });

    updateProgress(100, '¡Procesamiento finalizado con éxito!');

    // Mostrar resultados
    setTimeout(() => {
      progressArea.classList.add('d-none');
      displayParsedResults(container, {
        title: chatTitle,
        mediaCount: mediaCount || parsedData.mediaCount,
        ...parsedData
      });
    }, 400);

  } catch (error) {
    console.error('[ChatArchive] Error en importación:', error);
    progressArea.classList.add('d-none');
    dropzone.classList.remove('d-none');
    showToast('Error al Importar', error.message || 'No se pudo interpretar el archivo seleccionado.', 'danger');
  }
}

/**
 * Renderiza los resultados del análisis en la pantalla
 */
function displayParsedResults(container, data) {
  lastParsedPayload = data;
  const resultsArea = container.querySelector('#importResultsArea');
  if (!resultsArea) return;

  resultsArea.classList.remove('d-none');

  // Asignar título y métricas
  container.querySelector('#resChatTitle').textContent = data.title;
  container.querySelector('#resTotalMsgsBadge').textContent = `${data.totalMessages.toLocaleString()} mensajes`;
  container.querySelector('#resParticipantsCount').textContent = data.participants.length;
  container.querySelector('#resMediaCount').textContent = data.mediaCount;

  // Fechas
  const firstStr = data.firstDate ? formatDate(data.firstDate) : 'Desconocida';
  const lastStr = data.lastDate ? formatDate(data.lastDate) : 'Desconocida';
  container.querySelector('#resDateRange').textContent = `${firstStr} — ${lastStr}`;

  // Lista de participantes con badges
  const participantsContainer = container.querySelector('#resParticipantsList');
  participantsContainer.innerHTML = '';
  data.participants.forEach(p => {
    const badge = document.createElement('span');
    badge.className = 'badge ca-badge-soft-info p-2 rounded-3 d-inline-flex align-items-center gap-1';
    badge.innerHTML = `
      <i class="bi bi-person" aria-hidden="true"></i>
      <span>${escapeHTML(p.name)}</span>
      <span class="badge bg-secondary rounded-pill ms-1">${p.count}</span>
    `;
    participantsContainer.appendChild(badge);
  });

  if (data.participants.length === 0) {
    participantsContainer.innerHTML = '<span class="text-ca-muted small">No se identificaron participantes individuales (chat del sistema).</span>';
  }

  // Previsualización de los primeros 10 mensajes
  const previewContainer = container.querySelector('#resPreviewMessages');
  previewContainer.innerHTML = '';

  const sampleMessages = data.messages.slice(0, 10);
  sampleMessages.forEach(msg => {
    const row = document.createElement('div');
    row.className = 'py-2 border-bottom border-ca small';

    if (msg.type === 'system') {
      row.innerHTML = `
        <div class="text-center text-ca-muted fst-italic">
          <i class="bi bi-info-circle me-1" aria-hidden="true"></i> ${escapeHTML(msg.text)}
        </div>
      `;
    } else {
      const isMedia = msg.attachment;
      const mediaHtml = isMedia ? `
        <div class="mt-1 badge bg-secondary-subtle text-secondary border border-secondary-subtle d-inline-flex align-items-center gap-1">
          <i class="bi ${mediaManager.getIconClass(msg.attachment.fileName || '')}" aria-hidden="true"></i>
          <span>${escapeHTML(msg.attachment.fileName || 'Archivo adjunto')}</span>
        </div>
      ` : '';

      row.innerHTML = `
        <div class="d-flex justify-content-between align-items-baseline gap-2">
          <strong class="text-primary">${escapeHTML(msg.sender || 'Remitente')}</strong>
          <span class="text-ca-muted" style="font-size: 0.75rem;">${msg.rawTime || ''}</span>
        </div>
        <div class="text-ca-main mt-1">${escapeHTML(msg.text)}</div>
        ${mediaHtml}
      `;
    }
    previewContainer.appendChild(row);
  });
}
