/**
 * ChatArchive - Vista de Configuración y Preferencias
 */

import { state } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { formatBytes, showToast } from '../utils/helpers.js';

export function renderSettings(container) {
  const currentTheme = state.theme;
  const { usage, quota, percent } = state.storageEstimate;

  const html = `
    <div class="container-xl py-4">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-8">
          <!-- Encabezado de Ajustes -->
          <div class="mb-4">
            <h1 class="h3 mb-1 fw-bold">Configuración y Preferencias</h1>
            <p class="text-ca-muted mb-0 small">
              Personaliza el aspecto visual y gestiona los datos locales de ChatArchive.
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
              <small class="text-ca-muted d-block">
                <i class="bi bi-info-circle me-1" aria-hidden="true"></i>
                En la Etapa 6 se habilitarán las funciones completas de exportación y restauración de respaldos ZIP y JSON.
              </small>
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
  `;

  container.innerHTML = html;

  // Interacción del selector de tema
  container.querySelectorAll('.theme-picker-card').forEach(card => {
    card.addEventListener('click', () => {
      const selectedTheme = card.getAttribute('data-theme-val');
      state.setTheme(selectedTheme);
      showToast('Tema Actualizado', `Se ha aplicado el tema: ${selectedTheme}`, 'success');
      renderSettings(container);
    });
  });

  // Botón para refrescar almacenamiento
  const btnRefresh = container.querySelector('#btnRefreshStorage');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.disabled = true;
      await state.updateStorageEstimate();
      showToast('Almacenamiento Actualizado', 'Se han recalculado los valores de cuota local.', 'info');
      renderSettings(container);
    });
  }
}
