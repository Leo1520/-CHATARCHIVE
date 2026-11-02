/**
 * ChatArchive - Lector y Extractor Seguro de Archivos ZIP (JSZip)
 * Extrae el archivo de texto y todos los archivos adjuntos con protección Zip Slip
 */

import { isSafeZipPath, sanitizeFileName, detectMediaType } from '../utils/validation.js';
import { mediaManager } from './media-handler.js';
import { normalizeWhatsAppText } from './txt-reader.js';

export class ZipReader {
  /**
   * Lee y procesa un archivo ZIP exportado de WhatsApp
   * @param {File | Blob} zipFile Archivo ZIP
   * @param {Function} onProgress Callback de progreso (porcentaje, mensaje)
   * @returns {Promise<{ chatText: string, chatTitle: string, mediaCount: number, txtFileName: string }>}
   */
  static async readZip(zipFile, onProgress = () => {}) {
    if (!window.JSZip) {
      throw new Error('La biblioteca JSZip no está disponible en la ventana global.');
    }

    onProgress(10, 'Abriendo archivo comprimido...');
    const zip = new window.JSZip();
    const contents = await zip.loadAsync(zipFile);

    // 1. Localizar el archivo TXT principal del chat
    let txtFileEntry = null;
    let txtFileName = '';
    const fileEntries = Object.keys(contents.files);

    for (const path of fileEntries) {
      // Verificación de seguridad Zip Slip
      if (!isSafeZipPath(path)) {
        console.warn(`[ChatArchive] Ruta sospechosa omitida por seguridad: ${path}`);
        continue;
      }

      const entry = contents.files[path];
      if (entry.dir) continue;

      const lower = path.toLowerCase();
      if (lower.endsWith('.txt')) {
        // Preferir _chat.txt (iOS) o archivos que comiencen con "chat de whatsapp" o contengan "chat"
        if (!txtFileEntry || lower.includes('_chat.txt') || lower.includes('chat de whatsapp') || lower.includes('whatsapp chat')) {
          txtFileEntry = entry;
          txtFileName = path;
        }
      }
    }

    if (!txtFileEntry) {
      throw new Error('No se encontró ningún archivo de texto (.txt) de conversación dentro del archivo ZIP.');
    }

    // 2. Extraer el texto del chat
    onProgress(30, 'Extrayendo texto de la conversación...');
    const rawText = await txtFileEntry.async('string');
    const normalizedText = normalizeWhatsAppText(rawText);

    // 3. Extraer y registrar archivos multimedia adjuntos
    onProgress(45, 'Identificando archivos multimedia adjuntos...');
    mediaManager.clear();

    let processedFiles = 0;
    const mediaEntries = fileEntries.filter(path => {
      const entry = contents.files[path];
      return !entry.dir && !path.toLowerCase().endsWith('.txt') && isSafeZipPath(path);
    });

    const totalMedia = mediaEntries.length;

    for (let i = 0; i < totalMedia; i++) {
      const path = mediaEntries[i];
      const entry = contents.files[path];
      const cleanName = sanitizeFileName(path);
      const mediaType = detectMediaType(cleanName);

      if (mediaType !== 'unknown') {
        const blob = await entry.async('blob');
        mediaManager.registerMedia(cleanName, blob);
        processedFiles++;
      }

      // Progreso gradual entre 45% y 85%
      const pct = Math.round(45 + ((i + 1) / totalMedia) * 40);
      onProgress(pct, `Extrayendo archivo multimedia ${i + 1} de ${totalMedia}...`);
    }

    // 4. Determinar título preliminar del chat
    const chatTitle = deduceChatTitle(txtFileName, zipFile.name);

    onProgress(90, 'Extracción completada con éxito.');

    return {
      chatText: normalizedText,
      chatTitle,
      mediaCount: processedFiles,
      txtFileName: sanitizeFileName(txtFileName)
    };
  }
}

/**
 * Deduce el nombre del contacto o grupo a partir del nombre del archivo TXT o del ZIP
 * @param {string} txtFileName
 * @param {string} zipFileName
 * @returns {string}
 */
export function deduceChatTitle(txtFileName, zipFileName) {
  let title = '';

  // Intentar extraer de nombres comunes de WhatsApp en español e inglés
  const patterns = [
    /Chat de WhatsApp con (.+?)\.txt/i,
    /WhatsApp Chat with (.+?)\.txt/i,
    /Chat de WhatsApp - (.+?)\.txt/i,
    /WhatsApp Chat - (.+?)\.txt/i
  ];

  for (const regex of patterns) {
    const match = txtFileName.match(regex);
    if (match && match[1]) {
      title = match[1].trim();
      break;
    }
  }

  // Si se llamaba _chat.txt (iOS), deducir del nombre del archivo ZIP
  if (!title || txtFileName.toLowerCase().endsWith('_chat.txt')) {
    const zipClean = zipFileName.replace(/\.zip$/i, '').trim();
    for (const regex of patterns) {
      const match = zipClean.match(regex);
      if (match && match[1]) {
        title = match[1].trim();
        break;
      }
    }
    if (!title && zipClean && zipClean.toLowerCase() !== '_chat') {
      title = zipClean;
    }
  }

  return title || 'Conversación Importada';
}
