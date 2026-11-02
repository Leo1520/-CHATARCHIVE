/**
 * ChatArchive - Vista de Configuración, Preferencias y Respaldos (ZIP y JSON)
 */

import { state } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { formatBytes, showToast } from '../utils/helpers.js';
import { BackupExporter } from '../backup/export.js';
import { BackupRestorer } from '../backup/restore.js';
import { tutorialManager } from '../components/tutorial.js';

let pendingValidationResult = null;

export function renderSettings(container) {
  const currentTheme = state.theme;
  const { usage, quota, percent } = state.storageEstimate;

  const html = `
    <div class="container-xl py-4">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-8">
          <!-- Encabezado de Ajustes -->
          <div class="mb-4">
            <h1 class="h3 mb-1 fw-bold">Configuración y Respaldos</h1>
            <p class="text-ca-muted mb-0 small">
              Personaliza el aspecto visual, gestiona los datos de IndexedDB y crea copias de seguridad.
            </p>
          </div>

          <!-- Sección: Apariencia y Tema -->
          <div class="card bg-ca-surface border-ca shadow-sm rounded-4 mb-4">
            <div class="card-header bg-transparent border-ca py-3 px-4">
              <h2 class="h6 mb-0 fw-bold d-flex align-items-center gap-2">
                <i class="bi bi-palette text-ca-muted" aria-hidden="true"></i>
                <span>Apariencia y Tema</span>
              </h2>
            </div>
            <div class="card-body p-4">
              <label class="form-label small fw-semibold text-ca-muted mb-3">Modo de Color</label>
              <div class="row g-3">
                <div class="col-12 col-sm-4">
                  <div 
                    class="p-3 border rounded-3 text-center cursor-pointer theme-picker-card ${currentTheme === CONFIG.THEMES.LIGHT ? 'border-primary bg-ca-elevated' : 'border-ca'}"
                    data-theme-val="${CONFIG.THEMES.LIGHT}"
                    role="button"
                    tabindex="0"
                  >
                    <i class="bi bi-sun fs-3 text-warning mb-2 d-block" aria-hidden="true"></i>
                    <span class="fw-semibold small d-block">Modo Claro</span>
                  </div>
                </div>

                <div class="col-12 col-sm-4">
                  <div 
                    class="p-3 border rounded-3 text-center cursor-pointer theme-picker-card ${currentTheme === CONFIG.THEMES.DARK ? 'border-primary bg-ca-elevated' : 'border-ca'}"
                    data-theme-val="${CONFIG.THEMES.DARK}"
                    role="button"
                    tabindex="0"
                  >
                    <i class="bi bi-moon-stars fs-3 text-info mb-2 d-block" aria-hidden="true"></i>
                    <span class="fw-semibold small d-block">Modo Oscuro</span>
                  </div>
                </div>

                <div class="col-12 col-sm-4">
                  <div 
                    class="p-3 border rounded-3 text-center cursor-pointer theme-picker-card ${currentTheme === CONFIG.THEMES.AUTO ? 'border-primary bg-ca-elevated' : 'border-ca'}"
                    data-theme-val="${CONFIG.THEMES.AUTO}"
                    role="button"
                    tabindex="0"
                  >
                    <i class="bi bi-circle-half fs-3 text-secondary mb-2 d-block" aria-hidden="true"></i>
                    <span class="fw-semibold small d-block">Automático (SO)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Sección: Copias de Seguridad (Respaldos y Restauración) -->
          <div class="card bg-ca-surface border-ca shadow-sm rounded-4 mb-4">
            <div class="card-header bg-transparent border-ca py-3 px-4">
              <h2 class="h6 mb-0 fw-bold d-flex align-items-center gap-2">
                <i class="bi bi-archive text-ca-muted" aria-hidden="true"></i>
                <span>Copias de Seguridad y Restauración</span>
              </h2>
            </div>
            <div class="card-body p-4">
              <p class="small text-ca-muted mb-3">
                Crea copias de seguridad de todas tus conversaciones para guardarlas externamente o transferirlas a otro dispositivo.
              </p>

              <!-- Barra de Progreso de Respaldo -->
              <div id="backupProgressBox" class="p-3 border border-ca rounded-3 bg-ca-elevated mb-3 d-none">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <span class="small fw-semibold" id="backupStatusText">Procesando...</span>
                  <span class="small fw-bold text-primary" id="backupPercentText">0%</span>
                </div>
                <div class="progress" style="height: 8px;">
                  <div id="backupProgressBar" class="progress-bar progress-bar-striped progress-bar-animated bg-success" style="width: 0%;"></div>
                </div>
              </div>

              <!-- Botones de Exportación -->
              <div class="row g-3 mb-4">
                <div class="col-12 col-sm-6">
                  <div class="p-3 border border-ca rounded-3 bg-ca-elevated h-100 d-flex flex-column justify-content-between">
                    <div>
                      <h3 class="h6 fw-bold mb-1 d-flex align-items-center gap-2">
                        <i class="bi bi-file-earmark-zip text-warning fs-5" aria-hidden="true"></i>
                        <span>Respaldo Completo (ZIP)</span>
                      </h3>
                      <p class="text-ca-muted small mb-3">
                        Incluye todas las conversaciones, metadatos y todos los archivos multimedia (fotos, audios y documentos).
                      </p>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-primary w-100" id="btnExportZip">
                      <i class="bi bi-download me-1" aria-hidden="true"></i> Descargar ZIP
                    </button>
                  </div>
                </div>

                <div class="col-12 col-sm-6">
                  <div class="p-3 border border-ca rounded-3 bg-ca-elevated h-100 d-flex flex-column justify-content-between">
                    <div>
                      <h3 class="h6 fw-bold mb-1 d-flex align-items-center gap-2">
                        <i class="bi bi-file-earmark-text text-info fs-5" aria-hidden="true"></i>
                        <span>Respaldo Ligero (JSON)</span>
                      </h3>
                      <p class="text-ca-muted small mb-3">
                        Exporta las conversaciones y mensajes en texto estructurado. Tamaño muy reducido e ideal para archivado rápido.
                      </p>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-secondary w-100" id="btnExportJson">
                      <i class="bi bi-download me-1" aria-hidden="true"></i> Descargar JSON
                    </button>
                  </div>
                </div>
              </div>

              <!-- Zona de Restauración -->
              <div class="pt-3 border-top border-ca">
                <h3 class="h6 fw-bold mb-2 d-flex align-items-center gap-2">
                  <i class="bi bi-upload text-ca-muted" aria-hidden="true"></i>
                  <span>Restaurar Copia de Seguridad</span>
                </h3>
                <p class="text-ca-muted small mb-3">
                  Selecciona un archivo de respaldo generado previamente por ChatArchive (.zip o .json) para restaurar tu biblioteca.
                </p>

                <input type="file" id="restoreFileInput" class="d-none" accept=".zip,.json">
                <button type="button" class="btn btn-ca-primary btn-sm" id="btnTriggerRestore">
                  <i class="bi bi-folder2-open me-1" aria-hidden="true"></i> Seleccionar Respaldo (.zip / .json)
                </button>
              </div>
            </div>
          </div>

          <!-- Sección: Almacenamiento Local (IndexedDB) -->
          <div class="card bg-ca-surface border-ca shadow-sm rounded-4 mb-4">
            <div class="card-header bg-transparent border-ca py-3 px-4 d-flex align-items-center justify-content-between">
              <h2 class="h6 mb-0 fw-bold d-flex align-items-center gap-2">
                <i class="bi bi-hdd-network text-ca-muted" aria-hidden="true"></i>
                <span>Gestión de Almacenamiento Local</span>
              </h2>
              <button type="button" class="btn btn-sm btn-outline-secondary" id="btnRefreshStorage">
                <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i> Recalcular
              </button>
            </div>
            <div class="card-body p-4">
              <p class="small text-ca-muted mb-3">
                ChatArchive utiliza <strong>IndexedDB</strong> para almacenar tus conversaciones y archivos multimedia directamente en el navegador de tu dispositivo.
              </p>
              <div class="p-3 border-ca border rounded-3 mb-3 bg-ca-elevated">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <span class="small fw-semibold">Uso actual estimado:</span>
                  <span class="badge ca-badge-soft-info">${formatBytes(usage)} / ${quota > 0 ? formatBytes(quota) : 'Ilimitado'}</span>
                </div>
                <div class="progress" style="height: 6px;">
                  <div class="progress-bar bg-primary" role="progressbar" style="width: ${Math.max(percent, 2)}%;"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Sección: Privacidad y Transparencia -->
          <div class="card bg-ca-surface border-ca shadow-sm rounded-4 mb-4">
            <div class="card-header bg-transparent border-ca py-3 px-4">
              <h2 class="h6 mb-0 fw-bold d-flex align-items-center gap-2">
                <i class="bi bi-shield-check text-success" aria-hidden="true"></i>
                <span>Privacidad y Arquitectura Local</span>
              </h2>
            </div>
            <div class="card-body p-4">
              <ul class="list-unstyled small text-ca-muted mb-0 d-flex flex-column gap-2">
                <li class="d-flex align-items-start gap-2">
                  <i class="bi bi-check-circle-fill text-success mt-1" aria-hidden="true"></i>
                  <span><strong>100% Sin Servidores:</strong> No existe servidor intermedio, API de sincronización ni backend de base de datos remota.</span>
                </li>
                <li class="d-flex align-items-start gap-2">
                  <i class="bi bi-check-circle-fill text-success mt-1" aria-hidden="true"></i>
                  <span><strong>Cero Analíticas:</strong> No se envían estadísticas, eventos ni datos de navegación a servicios de terceros.</span>
                </li>
                <li class="d-flex align-items-start gap-2">
                  <i class="bi bi-check-circle-fill text-success mt-1" aria-hidden="true"></i>
                  <span><strong>Totalmente Offline:</strong> Funciona como Progressive Web App (PWA) sin requerir conexión a internet.</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Sección: Ayuda y Bienvenida -->
          <div class="card bg-ca-surface border-ca shadow-sm rounded-4 mb-4">
            <div class="card-header bg-transparent border-ca py-3 px-4">
              <h2 class="h6 mb-0 fw-bold d-flex align-items-center gap-2">
                <i class="bi bi-question-circle text-primary" aria-hidden="true"></i>
                <span>Ayuda y Bienvenida</span>
              </h2>
            </div>
            <div class="card-body p-4">
              <div class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3">
                <div>
                  <h3 class="h6 fw-bold mb-1">Tutorial de Bienvenida</h3>
                  <p class="text-ca-muted small mb-0">
                    Repasa el funcionamiento de la biblioteca, la importación de chats, los modos de perspectiva y la privacidad cuando lo desees.
                  </p>
                </div>
                <button type="button" class="btn btn-sm btn-outline-primary flex-shrink-0" id="btnRestartTutorial">
                  <i class="bi bi-play-circle me-1" aria-hidden="true"></i> Volver a ver el tutorial
                </button>
              </div>
            </div>
          </div>

          <!-- Sección: Información del Software -->
          <div class="text-center py-3">
            <div class="text-ca-muted small">
              <strong>${CONFIG.APP_NAME}</strong> versión ${CONFIG.APP_VERSION}
            </div>
            <div class="text-ca-muted small mt-1">
              Desarrollado para Android, Windows y Web • Compatible con GitHub Pages
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Modal de Confirmación y Opciones de Restauración -->
    <div class="modal fade" id="restoreModal" tabindex="-1" aria-labelledby="restoreModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header border-ca">
            <h5 class="modal-title fw-bold d-flex align-items-center gap-2" id="restoreModalLabel">
              <i class="bi bi-arrow-repeat text-primary" aria-hidden="true"></i>
              <span>Restaurar Copia de Seguridad</span>
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body">
            <div class="p-3 border border-ca rounded-3 bg-ca-elevated mb-3 small" id="restoreSummaryBox"></div>

            <label class="form-label small fw-semibold text-ca-muted mb-2">Método de Restauración</label>
            <div class="form-check mb-2">
              <input class="form-check-input" type="radio" name="restoreModeRadio" id="radioMerge" value="merge" checked>
              <label class="form-check-label small" for="radioMerge">
                <strong>Fusionar con la biblioteca actual</strong>
                <span class="text-ca-muted d-block">Conserva las conversaciones existentes y añade las nuevas del respaldo.</span>
              </label>
            </div>
            <div class="form-check">
              <input class="form-check-input text-danger" type="radio" name="restoreModeRadio" id="radioReplace" value="replace">
              <label class="form-check-label small text-danger" for="radioReplace">
                <strong>Reemplazar biblioteca por completo</strong>
                <span class="text-ca-muted d-block">Borra las conversaciones actuales antes de restaurar el respaldo.</span>
              </label>
            </div>
          </div>
          <div class="modal-footer border-ca">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-ca-primary btn-sm" id="btnConfirmRestore">
              <i class="bi bi-check-circle me-1" aria-hidden="true"></i> Iniciar Restauración
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  setupSettingsListeners(container);
}

function setupSettingsListeners(container) {
  // 1. Selector de tema
  container.querySelectorAll('.theme-picker-card').forEach(card => {
    card.addEventListener('click', () => {
      const selectedTheme = card.getAttribute('data-theme-val');
      state.setTheme(selectedTheme);
      showToast('Tema Actualizado', `Se ha aplicado el tema: ${selectedTheme}`, 'success');
      renderSettings(container);
    });
  });

  // 2. Botón para recalcular almacenamiento
  const btnRefresh = container.querySelector('#btnRefreshStorage');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.disabled = true;
      await state.updateStorageEstimate();
      showToast('Almacenamiento Actualizado', 'Se han recalculado los valores de cuota local.', 'info');
      renderSettings(container);
    });
  }

  // Elementos de la barra de progreso
  const progressBox = container.querySelector('#backupProgressBox');
  const progressBar = container.querySelector('#backupProgressBar');
  const statusText = container.querySelector('#backupStatusText');
  const percentText = container.querySelector('#backupPercentText');

  const setProgress = (pct, msg) => {
    progressBox.classList.remove('d-none');
    progressBar.style.width = `${pct}%`;
    percentText.textContent = `${pct}%`;
    statusText.textContent = msg;
  };

  const hideProgress = () => {
    setTimeout(() => {
      progressBox?.classList.add('d-none');
    }, 1200);
  };

  // 3. Exportar ZIP
  const btnExportZip = container.querySelector('#btnExportZip');
  if (btnExportZip) {
    btnExportZip.addEventListener('click', async () => {
      btnExportZip.disabled = true;
      try {
        await BackupExporter.exportToZip((pct, msg) => setProgress(pct, msg));
        showToast('Respaldo Descargado', 'Se ha generado y descargado el archivo ZIP exitosamente.', 'success');
      } catch (err) {
        showToast('Error de Respaldo', err.message, 'danger');
      } finally {
        btnExportZip.disabled = false;
        hideProgress();
      }
    });
  }

  // 4. Exportar JSON
  const btnExportJson = container.querySelector('#btnExportJson');
  if (btnExportJson) {
    btnExportJson.addEventListener('click', async () => {
      btnExportJson.disabled = true;
      try {
        await BackupExporter.exportToJson((pct, msg) => setProgress(pct, msg));
        showToast('Respaldo Descargado', 'Se ha generado y descargado el archivo JSON exitosamente.', 'success');
      } catch (err) {
        showToast('Error de Respaldo', err.message, 'danger');
      } finally {
        btnExportJson.disabled = false;
        hideProgress();
      }
    });
  }

  // 5. Flujo de Restauración
  const btnTrigger = container.querySelector('#btnTriggerRestore');
  const fileInput = container.querySelector('#restoreFileInput');
  const modalEl = container.querySelector('#restoreModal');
  const btnConfirm = container.querySelector('#btnConfirmRestore');

  if (btnTrigger && fileInput) {
    btnTrigger.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setProgress(10, 'Validando archivo de respaldo...');
      const validation = await BackupRestorer.validate(file);
      hideProgress();

      if (!validation.isValid) {
        showToast('Archivo No Válido', validation.error || 'El archivo seleccionado no es un respaldo válido de ChatArchive.', 'danger');
        fileInput.value = '';
        return;
      }

      pendingValidationResult = validation;

      // Mostrar resumen en el modal
      const summaryBox = container.querySelector('#restoreSummaryBox');
      const m = validation.manifest;
      summaryBox.innerHTML = `
        <div class="fw-bold mb-1"><i class="bi bi-file-earmark-check text-success me-1"></i> Respaldo verificado con éxito</div>
        <div>• <strong>Tipo:</strong> ${validation.type.toUpperCase()}</div>
        <div>• <strong>Conversaciones:</strong> ${m.totalConversations}</div>
        <div>• <strong>Mensajes:</strong> ${m.totalMessages.toLocaleString()}</div>
        ${m.totalMedia > 0 ? `<div>• <strong>Archivos multimedia:</strong> ${m.totalMedia}</div>` : ''}
        ${m.createdAt ? `<div>• <strong>Fecha del respaldo:</strong> ${new Date(m.createdAt).toLocaleString()}</div>` : ''}
      `;

      if (window.bootstrap && window.bootstrap.Modal) {
        new window.bootstrap.Modal(modalEl).show();
      }
    });
  }

  // Confirmar restauración
  if (btnConfirm) {
    btnConfirm.addEventListener('click', async () => {
      if (!pendingValidationResult) return;

      const mode = container.querySelector('input[name="restoreModeRadio"]:checked')?.value || 'merge';

      btnConfirm.disabled = true;
      btnConfirm.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Restaurando...';

      // Cerrar modal
      if (window.bootstrap && window.bootstrap.Modal) {
        const instance = window.bootstrap.Modal.getInstance(modalEl);
        instance?.hide();
      }

      try {
        const result = await BackupRestorer.restore(pendingValidationResult, mode, (pct, msg) => {
          setProgress(pct, msg);
        });

        showToast(
          '¡Restauración Exitosa!',
          `Se restauraron ${result.restoredConversations} conversación(es), ${result.restoredMessages.toLocaleString()} mensaje(s) y ${result.restoredMedia} archivo(s).`,
          'success'
        );

        renderSettings(container);
      } catch (err) {
        console.error('[ChatArchive] Error en restauración:', err);
        showToast('Error en Restauración', err.message, 'danger');
      } finally {
        btnConfirm.disabled = false;
        btnConfirm.innerHTML = '<i class="bi bi-check-circle me-1" aria-hidden="true"></i> Iniciar Restauración';
        fileInput.value = '';
        pendingValidationResult = null;
        hideProgress();
      }
    });
  }

  // 6. Volver a ver el tutorial interactivo
  const btnRestartTutorial = container.querySelector('#btnRestartTutorial');
  if (btnRestartTutorial) {
    btnRestartTutorial.addEventListener('click', () => {
      tutorialManager.show(true);
    });
  }
}
