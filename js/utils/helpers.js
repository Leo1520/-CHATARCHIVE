/**
 * ChatArchive - Funciones Utilitarias y Helpers
 */

/**
 * Formatea una cantidad de bytes a una unidad legible (KB, MB, GB)
 */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Escapa cadenas para prevenir inyecciones XSS al renderizar texto seguro
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  const p = document.createElement('p');
  p.textContent = String(str);
  return p.innerHTML;
}

/**
 * Formatea una fecha u objeto Date a formato legible en español
 */
export function formatDate(date, includeTime = false) {
  if (!date) return 'Fecha no disponible';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'Fecha inválida';

  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
  };
  return new Intl.DateTimeFormat('es-ES', options).format(d);
}

/**
 * Crea y muestra una notificación Toast de Bootstrap sin emojis
 * @param {string} title Título de la notificación
 * @param {string} message Mensaje descriptivo
 * @param {'success'|'danger'|'warning'|'info'} type Tipo de toast
 */
export function showToast(title, message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const iconMap = {
    success: 'bi-check-circle-fill text-success',
    danger: 'bi-exclamation-octagon-fill text-danger',
    warning: 'bi-exclamation-triangle-fill text-warning',
    info: 'bi-info-circle-fill text-info'
  };

  const iconClass = iconMap[type] || iconMap.info;
  const toastId = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  const toastEl = document.createElement('div');
  toastEl.className = 'toast align-items-center shadow-lg border-0 mb-2';
  toastEl.id = toastId;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');

  toastEl.innerHTML = `
    <div class="toast-header border-0 bg-ca-elevated">
      <i class="bi ${iconClass} me-2" aria-hidden="true"></i>
      <strong class="me-auto text-ca-main">${escapeHTML(title)}</strong>
      <small class="text-ca-muted">Ahora</small>
      <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Cerrar"></button>
    </div>
    <div class="toast-body bg-ca-surface text-ca-main">
      ${escapeHTML(message)}
    </div>
  `;

  container.appendChild(toastEl);

  if (window.bootstrap && window.bootstrap.Toast) {
    const toast = new window.bootstrap.Toast(toastEl, { delay: 4500 });
    toast.show();
    toastEl.addEventListener('hidden.bs.toast', () => {
      toastEl.remove();
    });
  } else {
    setTimeout(() => toastEl.remove(), 4500);
  }
}
