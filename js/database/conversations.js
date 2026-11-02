/**
 * ChatArchive - Operaciones CRUD de Conversaciones en IndexedDB
 */

import { dbService } from './db.js';

export class ConversationsRepository {
  /**
   * Guarda o actualiza una conversación en IndexedDB
   * @param {Object} conversation Objeto de conversación completo
   * @returns {Promise<string>} ID de la conversación guardada
   */
  static async save(conversation) {
    if (!conversation.id) {
      conversation.id = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    if (!conversation.importedAt) {
      conversation.importedAt = new Date().toISOString();
    }

    await dbService.transaction('conversations', 'readwrite', (store) => {
      store.put(conversation);
    });

    return conversation.id;
  }

  /**
   * Obtiene una conversación por su identificador único
   * @param {string} id
   * @returns {Promise<Object | null>}
   */
  static async getById(id) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await dbService.getDB();
        const tx = db.transaction('conversations', 'readonly');
        const store = tx.objectStore('conversations');
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Obtiene todas las conversaciones almacenadas con orden configurable
   * @param {'importedAt'|'lastDate'|'title'|'messages'} sortBy Campo de orden
   * @param {'asc'|'desc'} direction Dirección de orden
   * @returns {Promise<Array<Object>>}
   */
  static async getAll(sortBy = 'importedAt', direction = 'desc') {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await dbService.getDB();
        const tx = db.transaction('conversations', 'readonly');
        const store = tx.objectStore('conversations');
        const request = store.getAll();

        request.onsuccess = () => {
          const list = request.result || [];
          // Ordenar según el criterio solicitado
          list.sort((a, b) => {
            let valA, valB;
            if (sortBy === 'title') {
              valA = (a.title || '').toLowerCase();
              valB = (b.title || '').toLowerCase();
              return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else if (sortBy === 'messages') {
              valA = a.totalMessages || 0;
              valB = b.totalMessages || 0;
            } else if (sortBy === 'lastDate') {
              valA = a.lastDate ? new Date(a.lastDate).getTime() : 0;
              valB = b.lastDate ? new Date(b.lastDate).getTime() : 0;
            } else {
              // importedAt
              valA = a.importedAt ? new Date(a.importedAt).getTime() : 0;
              valB = b.importedAt ? new Date(b.importedAt).getTime() : 0;
            }

            return direction === 'asc' ? valA - valB : valB - valA;
          });

          resolve(list);
        };

        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Elimina una conversación y ejecuta el borrado en cascada de sus mensajes y archivos
   * @param {string} id ID de la conversación
   * @returns {Promise<boolean>}
   */
  static async delete(id) {
    const db = await dbService.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['conversations', 'messages', 'media'], 'readwrite');
      const convStore = tx.objectStore('conversations');
      const msgStore = tx.objectStore('messages');
      const mediaStore = tx.objectStore('media');

      // 1. Eliminar la conversación
      convStore.delete(id);

      // 2. Eliminar en cascada los mensajes asociados
      const msgIndex = msgStore.index('conversationId');
      const msgRequest = msgIndex.openKeyCursor(IDBKeyRange.only(id));
      msgRequest.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          msgStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      // 3. Eliminar en cascada los archivos multimedia
      const mediaIndex = mediaStore.index('conversationId');
      const mediaRequest = mediaIndex.openKeyCursor(IDBKeyRange.only(id));
      mediaRequest.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          mediaStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Eliminación abortada'));
    });
  }

  /**
   * Obtiene métricas agregadas globales de la base de datos
   * @returns {Promise<{ totalConversations: number, totalMessages: number, totalMedia: number }>}
   */
  static async getGlobalStats() {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await dbService.getDB();
        const tx = db.transaction(['conversations', 'messages', 'media'], 'readonly');

        const convCountReq = tx.objectStore('conversations').count();
        const msgCountReq = tx.objectStore('messages').count();
        const mediaCountReq = tx.objectStore('media').count();

        tx.oncomplete = () => {
          resolve({
            totalConversations: convCountReq.result || 0,
            totalMessages: msgCountReq.result || 0,
            totalMedia: mediaCountReq.result || 0
          });
        };

        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Busca si existe una conversación con el mismo título y fecha para prevenir duplicados
   * @param {string} title Título de la conversación
   * @param {Date|string} lastDate Fecha del último mensaje
   * @returns {Promise<Object|null>} Conversación existente o null
   */
  static async findPotentialDuplicate(title, lastDate) {
    const list = await this.getAll();
    const cleanTitle = (title || '').trim().toLowerCase();
    const lastDateIso = lastDate ? new Date(lastDate).toISOString().slice(0, 10) : '';

    return list.find(c => {
      const cTitle = (c.title || '').trim().toLowerCase();
      const cDateIso = c.lastDate ? new Date(c.lastDate).toISOString().slice(0, 10) : '';
      return cTitle === cleanTitle && cDateIso === lastDateIso;
    }) || null;
  }
}
