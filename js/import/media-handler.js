/**
 * ChatArchive - Gestor de Archivos Multimedia
 * Clasificación, gestión de Blobs, ObjectURLs seguras e iconografía Bootstrap Icons
 */

import { detectMediaType, getFileExtension } from '../utils/validation.js';

class MediaManager {
  constructor() {
    this.mediaBlobs = new Map(); // fileName -> Blob
    this.objectUrls = new Map(); // fileName -> objectUrl
  }

  /**
   * Registra un archivo multimedia en memoria
   * @param {string} fileName Nombre limpio del archivo
   * @param {Blob} blob Contenido binario
   */
  registerMedia(fileName, blob) {
    if (!fileName || !blob) return;
    this.mediaBlobs.set(fileName, blob);
  }

  /**
   * Obtiene el Blob de un archivo por nombre
   * @param {string} fileName
   * @returns {Blob | null}
   */
  getMediaBlob(fileName) {
    return this.mediaBlobs.get(fileName) || null;
  }

  /**
   * Comprueba si un archivo multimedia está disponible en memoria
   * @param {string} fileName
   * @returns {boolean}
   */
  hasMedia(fileName) {
    return this.mediaBlobs.has(fileName);
  }

  /**
   * Obtiene o crea una URL de objeto segura (blob:...) para visualizar el archivo
   * @param {string} fileName
   * @returns {string | null}
   */
  getMediaUrl(fileName) {
    if (this.objectUrls.has(fileName)) {
      return this.objectUrls.get(fileName);
    }

    const blob = this.mediaBlobs.get(fileName);
    if (!blob) return null;

    try {
      const url = URL.createObjectURL(blob);
      this.objectUrls.set(fileName, url);
      return url;
    } catch (e) {
      console.warn('[ChatArchive] No se pudo crear ObjectURL:', e);
      return null;
    }
  }

  /**
   * Revoca todas las ObjectURLs activas para liberar memoria del navegador
   */
  revokeAllUrls() {
    for (const url of this.objectUrls.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // Ignorar
      }
    }
    this.objectUrls.clear();
  }

  /**
   * Limpia toda la colección de medios
   */
  clear() {
    this.revokeAllUrls();
    this.mediaBlobs.clear();
  }

  /**
   * Obtiene el icono Bootstrap Icons adecuado para un archivo según su tipo
   * @param {string} fileName
   * @returns {string} Clase de icono (ej: "bi-image")
   */
  getIconClass(fileName) {
    const ext = getFileExtension(fileName);
    const type = detectMediaType(fileName);

    if (ext === 'pdf') return 'bi-file-earmark-pdf';
    if (type === 'image') return 'bi-image';
    if (type === 'video') return 'bi-camera-video';
    if (type === 'audio') {
      return ext === 'opus' ? 'bi-mic' : 'bi-file-earmark-music';
    }
    if (['doc', 'docx'].includes(ext)) return 'bi-file-earmark-word';
    if (['xls', 'xlsx'].includes(ext)) return 'bi-file-earmark-excel';
    if (['ppt', 'pptx'].includes(ext)) return 'bi-file-earmark-ppt';
    if (['zip', 'rar', '7z'].includes(ext)) return 'bi-file-earmark-zip';

    return 'bi-file-earmark';
  }
}

export const mediaManager = new MediaManager();
