/**
 * ChatArchive - Lector y Normalizador de Archivos de Texto TXT
 */

/**
 * Lee un archivo o Blob de texto plano con codificación UTF-8
 * @param {File | Blob} file
 * @returns {Promise<string>} Contenido del archivo normalizado
 */
export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No se proporcionó ningún archivo para leer.'));
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const rawText = event.target?.result || '';
        const normalized = normalizeWhatsAppText(rawText);
        resolve(normalized);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error(`Error al leer el archivo de texto: ${reader.error?.message || 'Error desconocido'}`));
    };

    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Normaliza el texto de WhatsApp eliminando BOM, normalizando saltos de línea
 * y limpiando marcas de dirección bidireccional invisibles (LTR/RTL)
 * @param {string} text Texto crudo
 * @returns {string} Texto limpio listo para el parser
 */
export function normalizeWhatsAppText(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    // Eliminar Byte Order Mark (BOM) UTF-8
    .replace(/^\uFEFF/, '')
    // Reemplazar saltos de línea de Windows/Mac clásicos por \n estándar
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Eliminar marcas de dirección invisible Unicode que WhatsApp coloca antes de fechas o nombres
    // \u200e (Left-to-Right Mark), \u200f (Right-to-Left Mark)
    // \u202a, \u202b, \u202c, \u202d, \u202e (Embedding/Overrides)
    // \u202f (Narrow No-Break Space), \xa0 (No-Break Space)
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .trim();
}
