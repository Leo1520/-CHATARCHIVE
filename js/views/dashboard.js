/**
 * ChatArchive - Vista de Dashboard / Inicio
 * Conectado con IndexedDB para estadísticas y conversaciones recientes
 */

import { state } from '../core/state.js';
import { formatBytes, formatDate, escapeHTML } from '../utils/helpers.js';
import { ConversationsRepository } from '../database/conversations.js';

export async function renderDashboard(container) {
  // 1. Obtener estadísticas globales reales
  let globalStats = { totalConversations: 0, totalMessages: 0, totalMedia: 0 };
  let recentConversations = [];

  try {
    globalStats = await ConversationsRepository.getGlobalStats();
    recentConversations = await ConversationsRepository.getAll('importedAt', 'desc');
    // Actualizar estado reactivo
    state.stats.totalConversations = globalStats.totalConversations;
    state.stats.totalMessages = globalStats.totalMessages;
    state.stats.totalMediaFiles = globalStats.totalMedia;
    await state.updateStorageEstimate();
  } catch (err) {
    console.warn('[ChatArchive] No se pudieron cargar estadísticas en Dashboard:', err);
  }

  const { usage, quota, percent } = state.storageEstimate;

  const html = `
    <div class="container-xl py-4">
      <!-- Encabezado de Bienvenida -->
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div class="d-flex align-items-center gap-3">
          <img src="./assets/logo/logo.svg" alt="ChatArchive Logo" class="rounded-3 shadow-sm" width="56" height="56">
          <div>
            <h1 class="h3 mb-1 fw-bold">Panel Principal</h1>
            <p class="text-ca-muted mb-0 small">
              Tu archivo personal de conversaciones de WhatsApp en un entorno privado y seguro.
            </p>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <a href="#import" class="btn btn-ca-primary">
            <i class="bi bi-cloud-arrow-up" aria-hidden="true"></i>
            <span>Importar Conversación</span>
          </a>
          <a href="#library" class="btn btn-outline-secondary">
            <i class="bi bi-collection" aria-hidden="true"></i>
            <span>Ver Biblioteca</span>
          </a>
        </div>
      </div>

      <!-- Banner de Privacidad Absoluta -->
      <div class="ca-privacy-banner mb-4">
        <div class="ca-stat-icon-wrapper ca-stat-icon-emerald">
          <i class="bi bi-shield-check" aria-hidden="true"></i>
        </div>
        <div class="flex-grow-1">
          <h2 class="h6 mb-1 fw-bold text-success">Privacidad Garantizada al 100%</h2>
          <p class="mb-0 small text-ca-muted">
            Todas tus conversaciones, archivos multimedia y datos se procesan y almacenan exclusivamente en este dispositivo mediante IndexedDB. Sin servidores externos, sin nube y sin telemetría.
          </p>
        </div>
        <div class="badge ca-badge-soft-success px-3 py-2 rounded-pill">
          <i class="bi bi-hdd-network me-1" aria-hidden="true"></i> Almacenamiento Local
        </div>
      </div>

      <!-- Métricas / Tarjetas de Estadísticas -->
      <div class="row g-3 mb-4">
        <div class="col-12 col-sm-6 col-lg-3">
          <div class="ca-stat-card">
            <div class="ca-stat-icon-wrapper ca-stat-icon-emerald">
              <i class="bi bi-chat-square-text" aria-hidden="true"></i>
            </div>
            <div>
              <div class="ca-stat-number" id="dashTotalChats">${globalStats.totalConversations}</div>
              <div class="ca-stat-label">Conversaciones</div>
            </div>
          </div>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <div class="ca-stat-card">
            <div class="ca-stat-icon-wrapper ca-stat-icon-blue">
              <i class="bi bi-chat-dots" aria-hidden="true"></i>
            </div>
            <div>
              <div class="ca-stat-number" id="dashTotalMessages">${globalStats.totalMessages.toLocaleString()}</div>
              <div class="ca-stat-label">Mensajes Guardados</div>
            </div>
          </div>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <div class="ca-stat-card">
            <div class="ca-stat-icon-wrapper ca-stat-icon-purple">
              <i class="bi bi-paperclip" aria-hidden="true"></i>
            </div>
            <div>
              <div class="ca-stat-number" id="dashTotalMedia">${globalStats.totalMedia.toLocaleString()}</div>
              <div class="ca-stat-label">Archivos Multimedia</div>
            </div>
          </div>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <div class="ca-stat-card">
            <div class="ca-stat-icon-wrapper ca-stat-icon-amber">
              <i class="bi bi-hdd" aria-hidden="true"></i>
            </div>
            <div>
              <div class="ca-stat-number" id="dashTotalStorage">${formatBytes(usage)}</div>
              <div class="ca-stat-label">Espacio Utilizado</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sección Principal: Conversaciones Recientes y Estado de Almacenamiento -->
      <div class="row g-4">
        <!-- Lista de Conversaciones Recientes -->
        <div class="col-12 col-lg-8">
          <div class="card bg-ca-surface border-ca shadow-sm rounded-4 h-100">
            <div class="card-header bg-transparent border-ca py-3 px-4 d-flex align-items-center justify-content-between">
              <div class="d-flex align-items-center gap-2">
                <i class="bi bi-clock-history text-ca-muted" aria-hidden="true"></i>
                <h2 class="h6 mb-0 fw-bold">Conversaciones Recientes</h2>
              </div>
              <a href="#library" class="small text-decoration-none">Ver todas <i class="bi bi-chevron-right" aria-hidden="true"></i></a>
            </div>
            <div class="card-body p-4 d-flex flex-column justify-content-center" id="recentChatsContainer">
              ${renderRecentChatsContent(recentConversations.slice(0, 5))}
            </div>
          </div>
        </div>

        <!-- Estado de Almacenamiento Local y Atajos -->
        <div class="col-12 col-lg-4">
          <div class="d-flex flex-column gap-4">
            <!-- Tarjeta de Almacenamiento -->
            <div class="card bg-ca-surface border-ca shadow-sm rounded-4">
              <div class="card-body p-4">
                <div class="d-flex align-items-center justify-content-between mb-3">
                  <h2 class="h6 mb-0 fw-bold d-flex align-items-center gap-2">
                    <i class="bi bi-pie-chart text-ca-muted" aria-hidden="true"></i>
                    <span>Almacenamiento Local</span>
                  </h2>
                  <span class="badge ca-badge-soft-info">${percent}% en uso</span>
                </div>
                <p class="small text-ca-muted mb-2">
                  Memoria asignada a la base de datos IndexedDB en tu navegador.
                </p>
                <div class="progress mb-3" style="height: 8px;">
                  <div class="progress-bar bg-success" role="progressbar" style="width: ${Math.max(percent, 2)}%;" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
                <div class="d-flex justify-content-between small text-ca-muted">
                  <span>${formatBytes(usage)} usados</span>
                  <span>${quota > 0 ? formatBytes(quota) : 'Ilimitado'} asignados</span>
                </div>
              </div>
            </div>

            <!-- Accesos Rápidos -->
            <div class="card bg-ca-surface border-ca shadow-sm rounded-4">
              <div class="card-body p-4">
                <h2 class="h6 mb-3 fw-bold d-flex align-items-center gap-2">
                  <i class="bi bi-lightning-charge text-ca-muted" aria-hidden="true"></i>
                  <span>Accesos Rápidos</span>
                </h2>
                <div class="d-grid gap-2">
                  <a href="#import" class="btn btn-outline-secondary text-start py-2 px-3 d-flex align-items-center justify-content-between">
                    <span class="d-flex align-items-center gap-2">
                      <i class="bi bi-file-earmark-zip" aria-hidden="true"></i>
                      <span>Importar archivo ZIP</span>
                    </span>
                    <i class="bi bi-arrow-right text-ca-muted" aria-hidden="true"></i>
                  </a>
                  <a href="#library" class="btn btn-outline-secondary text-start py-2 px-3 d-flex align-items-center justify-content-between">
                    <span class="d-flex align-items-center gap-2">
                      <i class="bi bi-search" aria-hidden="true"></i>
                      <span>Buscar en biblioteca</span>
                    </span>
                    <i class="bi bi-arrow-right text-ca-muted" aria-hidden="true"></i>
                  </a>
                  <a href="#settings" class="btn btn-outline-secondary text-start py-2 px-3 d-flex align-items-center justify-content-between">
                    <span class="d-flex align-items-center gap-2">
                      <i class="bi bi-gear" aria-hidden="true"></i>
                      <span>Preferencias y temas</span>
                    </span>
                    <i class="bi bi-arrow-right text-ca-muted" aria-hidden="true"></i>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderRecentChatsContent(chats) {
  if (!chats || chats.length === 0) {
    return `
      <div class="ca-empty-state">
        <div class="ca-empty-icon">
          <i class="bi bi-chat-left-text" aria-hidden="true"></i>
        </div>
        <h3 class="h5 fw-bold mb-2">Aún no tienes conversaciones importadas</h3>
        <p class="text-ca-muted small mb-4 mx-auto" style="max-width: 420px;">
          Comienza agregando un archivo exportado de WhatsApp (.zip o .txt) para reconstruir y explorar tus chats.
        </p>
        <a href="#import" class="btn btn-ca-primary">
          <i class="bi bi-cloud-arrow-up" aria-hidden="true"></i>
          <span>Importar Primera Conversación</span>
        </a>
      </div>
    `;
  }

  const itemsHtml = chats.map(c => `
    <div class="p-3 border-bottom border-ca d-flex align-items-center justify-content-between gap-3 hover-bg">
      <div class="d-flex align-items-center gap-3 min-w-0">
        <div class="ca-chat-avatar flex-shrink-0">
          <i class="bi bi-chat-dots" aria-hidden="true"></i>
        </div>
        <div class="text-truncate">
          <h3 class="h6 mb-0 fw-bold text-truncate text-ca-main">${escapeHTML(c.title)}</h3>
          <small class="text-ca-muted d-block text-truncate">
            Último mensaje: ${c.lastDate ? formatDate(c.lastDate, true) : 'Desconocido'}
          </small>
        </div>
      </div>
      <div class="d-flex align-items-center gap-2 flex-shrink-0">
        <span class="badge ca-badge-soft-success">${c.totalMessages.toLocaleString()} msgs</span>
        <a href="#chat?id=${c.id}" class="btn btn-sm btn-outline-secondary" title="Ver conversación" aria-label="Ver conversación">
          <i class="bi bi-chevron-right" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  `).join('');

  return `<div class="d-flex flex-column">${itemsHtml}</div>`;
}
