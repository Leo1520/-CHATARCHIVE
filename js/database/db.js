/**
 * ChatArchive - Conexión y Gestión de Base de Datos IndexedDB
 * Almacenamiento local seguro, persistente y estructurado sin dependencias externas
 */

import { CONFIG } from '../core/config.js';

class Database {
  constructor() {
    this.dbName = CONFIG.DB_NAME;
    this.dbVersion = CONFIG.DB_VERSION;
    this.db = null;
    this._initPromise = null;
  }

  /**
   * Abre la base de datos IndexedDB o devuelve la instancia abierta
   * @returns {Promise<IDBDatabase>}
   */
  async getDB() {
    if (this.db) return this.db;

    if (!this._initPromise) {
      this._initPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
          return reject(new Error('IndexedDB no está soportado en este navegador.'));
        }

        const request = window.indexedDB.open(this.dbName, this.dbVersion);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          console.log(`[ChatArchive DB] Creando/Actualizando esquema v${this.dbVersion}...`);

          // 1. Almacén de Conversaciones
          if (!db.objectStoreNames.contains('conversations')) {
            const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
            convStore.createIndex('title', 'title', { unique: false });
            convStore.createIndex('importedAt', 'importedAt', { unique: false });
            convStore.createIndex('lastDate', 'lastDate', { unique: false });
          }

          // 2. Almacén de Mensajes
          if (!db.objectStoreNames.contains('messages')) {
            const msgStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
            msgStore.createIndex('conversationId', 'conversationId', { unique: false });
            msgStore.createIndex('conv_index', ['conversationId', 'index'], { unique: false });
            msgStore.createIndex('sender', 'sender', { unique: false });
            msgStore.createIndex('dateKey', 'dateKey', { unique: false });
          }

          // 3. Almacén de Archivos Multimedia (Blobs binarios)
          if (!db.objectStoreNames.contains('media')) {
            const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
            mediaStore.createIndex('conversationId', 'conversationId', { unique: false });
            mediaStore.createIndex('fileName', 'fileName', { unique: false });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          this.db.onversionchange = () => {
            this.db.close();
            this.db = null;
            console.warn('[ChatArchive DB] Versión de base de datos modificada en otra pestaña.');
          };
          resolve(this.db);
        };

        request.onerror = (event) => {
          console.error('[ChatArchive DB] Error al abrir IndexedDB:', event.target.error);
          reject(event.target.error);
        };
      });
    }

    return this._initPromise;
  }

  /**
   * Ejecuta una transacción genérica en uno o varios almacenes
   * @param {string|string[]} storeNames Nombre o nombres de los object stores
   * @param {'readonly'|'readwrite'} mode Modo de la transacción
   * @param {Function} callback Callback con los stores necesarios
   * @returns {Promise<any>}
   */
  async transaction(storeNames, mode, callback) {
    const db = await this.getDB();
    const stores = Array.isArray(storeNames) ? storeNames : [storeNames];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      const storeMap = {};
      stores.forEach(name => {
        storeMap[name] = tx.objectStore(name);
      });

      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = (event) => reject(event.target.error);
      tx.onabort = (event) => reject(event.target.error || new Error('Transacción abortada'));

      try {
        result = callback(Array.isArray(storeNames) ? storeMap : storeMap[stores[0]], tx);
      } catch (err) {
        tx.abort();
        reject(err);
      }
    });
  }
}

export const dbService = new Database();
