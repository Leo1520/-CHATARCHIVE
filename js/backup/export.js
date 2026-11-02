/**
 * ChatArchive - Módulo de Exportación de Respaldos (ZIP y JSON)
 * Empaqueta conversaciones, mensajes y archivos multimedia localmente sin servidores
 */

import { ConversationsRepository } from '../database/conversations.js';
import { MessagesRepository } from '../database/messages.js';
import { dbService } from '../database/db.js';
import { CONFIG } from '../core/config.js';

export class BackupExporter {
  /**
   * Exporta un respaldo completo de la biblioteca en formato ZIP (incluye multimedia)
   * @param {Function} onProgress Callback de progreso (0 - 100, mensaje)
   * @returns {Promise<Blob>}
   */
  static async exportToZip(onProgress = () => {}) {
    if (!window.JSZip) {
      throw new Error('La biblioteca JSZip no está disponible.');
    }

    onProgress(5, 'Recopilando conversaciones...');
    const conversations = await ConversationsRepository.getAll('importedAt', 'desc');

    if (conversations.length === 0) {
      throw new Error('No hay conversaciones en tu biblioteca para respaldar.');
    }

    onProgress(15, 'Recopilando mensajes...');
    const allMessages = [];
    for (let i = 0; i < conversations.length; i++) {
      const conv = conversations[i];
      const msgs = await MessagesRepository.getAllMessagesByConversation(conv.id);
      allMessages.push(...msgs);
      const pct = Math.round(15 + ((i + 1) / conversations.length) * 25);
      onProgress(pct, `Recopilando mensajes de "${conv.title}"...`);
    }

    onProgress(40, 'Recopilando archivos multimedia almacenados...');
    const zip = new window.JSZip();

    // 1. Manifiesto del respaldo
    const manifest = {
      app: CONFIG.APP_NAME,
      version: CONFIG.APP_VERSION,
      type: 'full_zip',
      createdAt: new Date().toISOString(),
      stats: {
        totalConversations: conversations.length,
        totalMessages: allMessages.length
      }
    };

    zip.file('chatarchive_manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('conversations.json', JSON.stringify(conversations, null, 2));
    zip.file('messages.json', JSON.stringify(allMessages, null, 2));

    // 2. Extraer todos los blobs multimedia de IndexedDB
    const mediaFolder = zip.folder('media');
    const db = await dbService.getDB();
    
    await new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readonly');
      const store = tx.objectStore('media');
      const req = store.getAll();

      req.onsuccess = () => {
        const mediaRecords = req.result || [];
        manifest.stats.totalMedia = mediaRecords.length;

        mediaRecords.forEach(record => {
          if (record.blob) {
            // Guardar con ID seguro en la carpeta media/
            mediaFolder.file(record.id, record.blob);
          }
        });
        resolve();
      };
      req.onerror = () => reject(req.error);
    });

    onProgress(65, 'Comprimiendo archivo de respaldo ZIP...');
    const zipBlob = await zip.generateAsync(
      {
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      },
      (metadata) => {
        const pct = Math.round(65 + (metadata.percent * 0.3));
        onProgress(pct, `Comprimiendo respaldo: ${metadata.percent.toFixed(0)}%...`);
      }
    );

    onProgress(100, 'Respaldo ZIP generado exitosamente.');

    // Descargar en el navegador
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadBlob(zipBlob, `chatarchive_backup_${dateStr}.zip`);

    return zipBlob;
  }

  /**
   * Exporta un respaldo ligero estructurado en formato JSON (conversaciones y mensajes)
   * @param {Function} onProgress Callback de progreso (0 - 100, mensaje)
   * @returns {Promise<Blob>}
   */
  static async exportToJson(onProgress = () => {}) {
    onProgress(10, 'Recopilando conversaciones...');
    const conversations = await ConversationsRepository.getAll('importedAt', 'desc');

    if (conversations.length === 0) {
      throw new Error('No hay conversaciones en tu biblioteca para respaldar.');
    }

    onProgress(30, 'Recopilando mensajes...');
    const allMessages = [];
    for (let i = 0; i < conversations.length; i++) {
      const conv = conversations[i];
      const msgs = await MessagesRepository.getAllMessagesByConversation(conv.id);
      allMessages.push(...msgs);
      const pct = Math.round(30 + ((i + 1) / conversations.length) * 50);
      onProgress(pct, `Extrayendo mensajes de "${conv.title}"...`);
    }

    onProgress(85, 'Generando archivo estructurado JSON...');
    const payload = {
      app: CONFIG.APP_NAME,
      version: CONFIG.APP_VERSION,
      type: 'structured_json',
      createdAt: new Date().toISOString(),
      stats: {
        totalConversations: conversations.length,
        totalMessages: allMessages.length
      },
      conversations,
      messages: allMessages
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const jsonBlob = new Blob([jsonString], { type: 'application/json' });

    onProgress(100, 'Respaldo JSON generado exitosamente.');

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadBlob(jsonBlob, `chatarchive_backup_${dateStr}.json`);

    return jsonBlob;
  }
}

/**
 * Desencadena la descarga de un Blob en el navegador de manera segura
 * @param {Blob} blob
 * @param {string} fileName
 */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}
