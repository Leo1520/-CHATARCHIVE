/**
 * ChatArchive - Validación y Seguridad de Archivos
 * Protección contra Zip Slip, rutas maliciosas y verificación de extensiones
 */

// Extensiones multimedia admitidas por WhatsApp
export const ALLOWED_MEDIA_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  video: ['mp4', '3gp', 'mov', 'webm'],
  audio: ['opus', 'm4a', 'mp3', 'ogg', 'aac', 'wav'],
  voice: ['opus'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'vcf', 'zip']
};

/**
 * Valida que una ruta de archivo dentro de un ZIP no contenga secuencias de Zip Slip
 * @param {string} entryPath Ruta interna del archivo dentro del archivo comprimido
 * @returns {boolean} true si es seguro, false si es sospechoso
 */
export function isSafeZipPath(entryPath) {
  if (!entryPath || typeof entryPath !== 'string') return false;

  // Normalizar separadores a barra diagonal
  const normalized = entryPath.replace(/\\/g, '/');

  // Rechazar rutas que intenten subir directorios con '..'
  const parts = normalized.split('/');
  let depth = 0;
  for (const part of parts) {
    if (part === '..') {
      depth--;
      if (depth < 0) return false;
    } else if (part !== '' && part !== '.') {
      depth++;
    }
  }

  // Rechazar rutas que comiencen con / o letras de unidad de Windows (C:)
  if (/^[a-zA-Z]:/.test(normalized) || normalized.startsWith('/')) {
    return false;
  }

  return true;
}

/**
 * Extrae y limpia el nombre base de un archivo
 * @param {string} fullPath Ruta completa o nombre de archivo
 * @returns {string} Nombre seguro sin directorios
 */
export function sanitizeFileName(fullPath) {
  if (!fullPath) return 'archivo_desconocido';
  const cleanPath = fullPath.replace(/\\/g, '/');
  const baseName = cleanPath.split('/').pop() || 'archivo_desconocido';
  // Eliminar caracteres de control peligrosos
  return baseName.replace(/[\x00-\x1f\x7f]/g, '').trim();
}

/**
 * Obtiene la extensión en minúsculas de un archivo
 * @param {string} fileName Nombre del archivo
 * @returns {string} Extensión sin el punto (ej: 'jpg')
 */
export function getFileExtension(fileName) {
  if (!fileName) return '';
  const parts = fileName.split('.');
  if (parts.length <= 1) return '';
  return parts.pop().toLowerCase().trim();
}

/**
 * Clasifica el tipo de archivo según su extensión
 * @param {string} fileName Nombre del archivo
 * @returns {'image'|'video'|'audio'|'document'|'unknown'}
 */
export function detectMediaType(fileName) {
  const ext = getFileExtension(fileName);
  if (!ext) return 'unknown';

  if (ALLOWED_MEDIA_EXTENSIONS.image.includes(ext)) return 'image';
  if (ALLOWED_MEDIA_EXTENSIONS.video.includes(ext)) return 'video';
  if (ALLOWED_MEDIA_EXTENSIONS.audio.includes(ext)) return 'audio';
  if (ALLOWED_MEDIA_EXTENSIONS.document.includes(ext)) return 'document';

  return 'unknown';
}
