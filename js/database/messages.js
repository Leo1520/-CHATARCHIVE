/**
 * ChatArchive - Operaciones de Mensajes y Archivos Multimedia en IndexedDB
 * Soporta almacenamiento por lotes (batching), paginación y recuperación de Blobs
 */

import { dbService } from './db.js';

export class MessagesRepository {
  /**
   * Guarda un conjunto de mensajes en lote dentro de IndexedDB
   * @param {string} conversationId ID de la conversación asociada
   * @param {Array<Object>} messages Lista de mensajes analizados
   * @param {Function} onProgress Callback de progreso (0 - 100)
   * @returns {Promise<number>} Cantidad de mensajes guardados
   */
  static async bulkSaveMessages(conversationId, messages, onProgress = () => {}) {
    if (!messages || messages.length === 0) return 0;

    const db = await dbService.getDB();
    const batchSize = 1000;
    const total = messages.length;
    let savedCount = 0;

    // Procesar en lotes de 1000 mensajes por transacción
    for (let i = 0; i < total; i += batchSize) {
      const chunk = messages.slice(i, i + batchSize);

      await new Promise((resolve, reject) => {
        const tx = db.transaction('messages', 'readwrite');
        const store = tx.objectStore('messages');

        chunk.forEach((msg, idx) => {
          const record = {
            conversationId,
            index: i + idx,
            date: msg.date ? msg.date.toISOString() : null,
            dateKey: msg.dateKey || 'fecha_desconocida',
            rawDate: msg.rawDate || '',
            rawTime: msg.rawTime || '',
            type: msg.type || 'user',
            sender: msg.sender || null,
            text: msg.text || '',
            attachment: msg.attachment ? {
              fileName: msg.attachment.fileName,
              mediaType: msg.attachment.mediaType,
              isOmitted: msg.attachment.isOmitted
            } : null
          };
          store.add(record);
        });

        tx.oncomplete = () => {
          savedCount += chunk.length;
          const pct = Math.round((savedCount / total) * 100);
          onProgress(pct, `Guardando mensajes ${savedCount} de ${total}...`);
          resolve();
        };

        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transacción abortada'));
      });
    }

    return savedCount;
  }

  /**
   * Guarda los archivos multimedia asociados a la conversación
   * @param {string} conversationId
   * @param {Map<string, Blob>} mediaBlobs Mapa de nombre de archivo a Blob
   * @param {Function} onProgress
   * @returns {Promise<number>} Cantidad de archivos multimedia almacenados
   */
  static async saveMediaFiles(conversationId, mediaBlobs, onProgress = () => {}) {
    if (!mediaBlobs || mediaBlobs.size === 0) return 0;

    const db = await dbService.getDB();
    const entries = Array.from(mediaBlobs.entries());
    const total = entries.length;
    let saved = 0;

    const tx = db.transaction('media', 'readwrite');
    const store = tx.objectStore('media');

    return new Promise((resolve, reject) => {
      entries.forEach(([fileName, blob]) => {
        const record = {
          id: `${conversationId}_${fileName}`,
          conversationId,
          fileName,
          blob,
          size: blob.size,
          type: blob.type
        };
        store.put(record);
        saved++;
      });

      tx.oncomplete = () => {
        onProgress(100, `Guardados ${saved} archivos multimedia.`);
        resolve(saved);
      };

      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Error al guardar archivos multimedia'));
    });
  }

  /**
   * Obtiene mensajes paginados de una conversación ordenados por índice
   * @param {string} conversationId
   * @param {number} offset Desplazamiento inicial
   * @param {number} limit Cantidad máxima a recuperar
   * @returns {Promise<Array<Object>>}
   */
  static async getMessagesByConversation(conversationId, offset = 0, limit = 50) {
    const db = await dbService.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const index = store.index('conversationId');
      const range = IDBKeyRange.only(conversationId);

      const request = index.openCursor(range);
      const results = [];
      let hasSkipped = false;
      let counter = 0;

      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) {
          return resolve(results);
        }

        if (!hasSkipped && offset > 0) {
          hasSkipped = true;
          cursor.advance(offset);
          return;
        }

        results.push(cursor.value);
        counter++;

        if (counter < limit) {
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtiene el Blob binario de un archivo multimedia por conversación y nombre
   * @param {string} conversationId
   * @param {string} fileName
   * @returns {Promise<Blob | null>}
   */
  static async getMediaBlob(conversationId, fileName) {
    const db = await dbService.getDB();
    const id = `${conversationId}_${fileName}`;

    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readonly');
      const store = tx.objectStore('media');
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result?.blob || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cuenta la cantidad de mensajes de una conversación
   * @param {string} conversationId
   * @returns {Promise<number>}
   */
  static async countByConversation(conversationId) {
    const db = await dbService.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const index = store.index('conversationId');
      const request = index.count(IDBKeyRange.only(conversationId));

      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => reject(request.error);
    });
  }
}
