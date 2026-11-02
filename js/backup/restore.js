/**
 * ChatArchive - Módulo de Validación y Restauración de Respaldos (ZIP y JSON)
 * Procesa copias de seguridad de forma 100% local sin servidores
 */

import { ConversationsRepository } from '../database/conversations.js';
import { MessagesRepository } from '../database/messages.js';
import { dbService } from '../database/db.js';
import { isSafeZipPath } from '../utils/validation.js';
import { state } from '../core/state.js';

export class BackupRestorer {
  /**
   * Valida preliminarmente un archivo de respaldo antes de restaurarlo
   * @param {File | Blob} file Archivo seleccionado
   * @returns {Promise<{ isValid: boolean, type: 'zip'|'json', manifest: Object, error?: string }>}
   */
  static async validate(file) {
    if (!file) {
      return { isValid: false, type: 'json', manifest: null, error: 'No se seleccionó ningún archivo.' };
    }

    const name = file.name.toLowerCase();
    const isZip = name.endsWith('.zip');
    const isJson = name.endsWith('.json');

    if (!isZip && !isJson) {
      return { isValid: false, type: 'json', manifest: null, error: 'El archivo debe tener extensión .zip o .json.' };
    }

    try {
      if (isJson) {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!Array.isArray(data.conversations) || !Array.isArray(data.messages)) {
          return {
            isValid: false,
            type: 'json',
            manifest: null,
            error: 'El archivo JSON no contiene la estructura requerida de ChatArchive (conversations y messages).'
          };
        }

        return {
          isValid: true,
          type: 'json',
          manifest: {
            app: data.app || 'ChatArchive',
            version: data.version || '1.0.0',
            createdAt: data.createdAt || null,
            totalConversations: data.conversations.length,
            totalMessages: data.messages.length,
            totalMedia: 0
          },
          data
        };
      } else {
        // Validación de archivo ZIP
        if (!window.JSZip) {
          throw new Error('La biblioteca JSZip no está disponible.');
        }

        const zip = new window.JSZip();
        const contents = await zip.loadAsync(file);

        // Comprobar archivos requeridos
        const convFile = contents.file('conversations.json');
        const msgFile = contents.file('messages.json');

        if (!convFile || !msgFile) {
          return {
            isValid: false,
            type: 'zip',
            manifest: null,
            error: 'El archivo ZIP no contiene conversations.json o messages.json válidos de ChatArchive.'
          };
        }

        const convText = await convFile.async('string');
        const conversations = JSON.parse(convText);

        const manifestFile = contents.file('chatarchive_manifest.json');
        let manifestData = {};
        if (manifestFile) {
          manifestData = JSON.parse(await manifestFile.async('string'));
        }

        // Contar archivos multimedia en media/
        let mediaCount = 0;
        contents.forEach((relativePath, entry) => {
          if (!entry.dir && relativePath.startsWith('media/') && isSafeZipPath(relativePath)) {
            mediaCount++;
          }
        });

        return {
          isValid: true,
          type: 'zip',
          manifest: {
            app: manifestData.app || 'ChatArchive',
            version: manifestData.version || '1.0.0',
            createdAt: manifestData.createdAt || null,
            totalConversations: conversations.length,
            totalMessages: manifestData.stats?.totalMessages || 0,
            totalMedia: mediaCount
          },
          zipContents: contents,
          conversations
        };
      }
    } catch (err) {
      console.error('[ChatArchive] Error al validar respaldo:', err);
      return {
        isValid: false,
        type: isZip ? 'zip' : 'json',
        manifest: null,
        error: `Archivo corrupto o formato no válido: ${err.message}`
      };
    }
  }

  /**
   * Ejecuta la restauración de un respaldo validado en IndexedDB
   * @param {Object} validationResult Resultado devuelto por BackupRestorer.validate
   * @param {'merge'|'replace'} mode Modo de restauración ('merge' añade sin borrar; 'replace' limpia primero)
   * @param {Function} onProgress Callback de progreso
   * @returns {Promise<{ restoredConversations: number, restoredMessages: number, restoredMedia: number }>}
   */
  static async restore(validationResult, mode = 'merge', onProgress = () => {}) {
    if (!validationResult || !validationResult.isValid) {
      throw new Error(validationResult?.error || 'Respaldo no válido.');
    }

    const db = await dbService.getDB();

    // 1. Si el modo es 'replace', vaciar los almacenes de IndexedDB
    if (mode === 'replace') {
      onProgress(5, 'Limpiando datos anteriores para restauración limpia...');
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['conversations', 'messages', 'media'], 'readwrite');
        tx.objectStore('conversations').clear();
        tx.objectStore('messages').clear();
        tx.objectStore('media').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    let restoredConversations = 0;
    let restoredMessages = 0;
    let restoredMedia = 0;

    if (validationResult.type === 'json') {
      const { conversations, messages } = validationResult.data;

      // Guardar conversaciones
      onProgress(20, 'Restaurando conversaciones...');
      for (const conv of conversations) {
        await ConversationsRepository.save(conv);
        restoredConversations++;
      }

      // Guardar mensajes en lotes
      onProgress(50, 'Restaurando mensajes...');
      const batchSize = 1000;
      for (let i = 0; i < messages.length; i += batchSize) {
        const chunk = messages.slice(i, i + batchSize);
        await new Promise((resolve, reject) => {
          const tx = db.transaction('messages', 'readwrite');
          const store = tx.objectStore('messages');
          chunk.forEach(m => store.put(m));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        restoredMessages += chunk.length;
        const pct = Math.round(50 + (restoredMessages / messages.length) * 45);
        onProgress(pct, `Restaurando mensajes ${restoredMessages} de ${messages.length}...`);
      }
    } else {
      // Restauración de ZIP completo
      const zip = validationResult.zipContents;
      const conversations = validationResult.conversations;

      // 1. Guardar conversaciones
      onProgress(15, 'Restaurando metadatos de conversaciones...');
      for (const conv of conversations) {
        await ConversationsRepository.save(conv);
        restoredConversations++;
      }

      // 2. Extraer y guardar mensajes
      onProgress(35, 'Extrayendo y restaurando mensajes...');
      const msgFile = zip.file('messages.json');
      const messagesText = await msgFile.async('string');
      const messages = JSON.parse(messagesText);

      const batchSize = 1000;
      for (let i = 0; i < messages.length; i += batchSize) {
        const chunk = messages.slice(i, i + batchSize);
        await new Promise((resolve, reject) => {
          const tx = db.transaction('messages', 'readwrite');
          const store = tx.objectStore('messages');
          chunk.forEach(m => store.put(m));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        restoredMessages += chunk.length;
        const pct = Math.round(35 + (restoredMessages / messages.length) * 35);
        onProgress(pct, `Restaurando mensajes ${restoredMessages} de ${messages.length}...`);
      }

      // 3. Extraer y restaurar archivos multimedia
      onProgress(75, 'Restaurando archivos multimedia...');
      const mediaEntries = [];
      zip.forEach((path, entry) => {
        if (!entry.dir && path.startsWith('media/') && isSafeZipPath(path)) {
          mediaEntries.push({ path, entry, id: path.replace(/^media\//, '') });
        }
      });

      const totalMedia = mediaEntries.length;
      for (let i = 0; i < totalMedia; i++) {
        const { id, entry } = mediaEntries[i];
        const blob = await entry.async('blob');

        // Extraer conversationId y fileName del ID: "conv_xxx_foto.jpg"
        const firstUnderscore = id.indexOf('_');
        const secondUnderscore = id.indexOf('_', firstUnderscore + 1);
        const convId = id.substring(0, secondUnderscore);
        const fileName = id.substring(secondUnderscore + 1);

        await new Promise((resolve, reject) => {
          const tx = db.transaction('media', 'readwrite');
          const store = tx.objectStore('media');
          store.put({
            id,
            conversationId: convId,
            fileName,
            blob,
            size: blob.size,
            type: blob.type
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

        restoredMedia++;
        const pct = Math.round(75 + ((i + 1) / totalMedia) * 20);
        onProgress(pct, `Restaurando archivo multimedia ${i + 1} de ${totalMedia}...`);
      }
    }

    onProgress(100, '¡Restauración completada con éxito!');

    // Actualizar estado global y cuota
    const globalStats = await ConversationsRepository.getGlobalStats();
    state.stats = {
      totalConversations: globalStats.totalConversations,
      totalMessages: globalStats.totalMessages,
      totalMediaFiles: globalStats.totalMedia,
      totalStorageBytes: state.storageEstimate.usage
    };
    await state.updateStorageEstimate();
    state.notify();

    return {
      restoredConversations,
      restoredMessages,
      restoredMedia
    };
  }
}
