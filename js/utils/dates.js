/**
 * ChatArchive - Parser y Manejador de Fechas de WhatsApp
 * Soporta DD/MM/YY, DD/MM/YYYY, MM/DD/YY, formatos de 12 horas y 24 horas
 */

/**
 * Normaliza una cadena de tiempo eliminando espacios finos y caracteres extraños de AM/PM
 * @param {string} timeStr Cadena de hora (ej: "2:30 p. m.", "14:20", "09:15:22 AM")
 * @returns {{ hour: number, minute: number, second: number }}
 */
export function parseTimeString(timeStr) {
  if (!timeStr) return { hour: 0, minute: 0, second: 0 };

  // Limpiar caracteres invisibles, espacios no rompibles (NBSP) y espacios estrechos (NNBSP)
  const cleanTime = timeStr
    .replace(/[\u200e\u200f\u202a-\u202e\u202f\xa0]/g, ' ')
    .trim();

  // Detectar indicador de período (AM/PM)
  const isPM = /p\.?\s*m\.?/i.test(cleanTime);
  const isAM = /a\.?\s*m\.?/i.test(cleanTime);

  // Extraer números (horas, minutos, segundos opcionales)
  const digits = cleanTime.match(/\d+/g);
  if (!digits || digits.length < 2) {
    return { hour: 0, minute: 0, second: 0 };
  }

  let hour = parseInt(digits[0], 10);
  const minute = parseInt(digits[1], 10);
  const second = digits[2] ? parseInt(digits[2], 10) : 0;

  if (isPM && hour < 12) {
    hour += 12;
  } else if (isAM && hour === 12) {
    hour = 0;
  }

  return { hour, minute, second };
}

/**
 * Parsea una cadena de fecha intentando detectar el formato
 * @param {string} dateStr Cadena de fecha (ej: "15/08/23", "15/08/2023", "2023-08-15")
 * @param {'DMY'|'MDY'|'YMD'} preferredOrder Orden preferido si es ambiguo (por defecto DMY en español)
 * @returns {{ year: number, month: number, day: number } | null}
 */
export function parseDateString(dateStr, preferredOrder = 'DMY') {
  if (!dateStr) return null;

  // Limpiar caracteres de control y separadores uniformes
  const cleanDate = dateStr
    .replace(/[\u200e\u200f\u202a-\u202e\u202f\xa0]/g, '')
    .trim();

  // Detectar formato ISO YYYY-MM-DD
  const isoMatch = cleanDate.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10) - 1,
      day: parseInt(isoMatch[3], 10)
    };
  }

  // Detectar formatos tradicionales con separador / o . o -
  const parts = cleanDate.match(/\d+/g);
  if (!parts || parts.length < 3) return null;

  let n1 = parseInt(parts[0], 10);
  let n2 = parseInt(parts[1], 10);
  let n3 = parseInt(parts[2], 10);

  // Si el año viene en 2 dígitos (ej: 23 -> 2023)
  if (n3 < 100) {
    n3 += n3 < 70 ? 2000 : 1900;
  }

  let day, month;

  // Lógica de desambiguación inteligente
  if (n1 > 12) {
    // Claramente n1 es el día (ej: 28/05/2023)
    day = n1;
    month = n2 - 1;
  } else if (n2 > 12) {
    // Claramente n2 es el día (ej: 05/28/2023 formato US)
    day = n2;
    month = n1 - 1;
  } else {
    // Ambos <= 12, usamos el orden preferido
    if (preferredOrder === 'MDY') {
      month = n1 - 1;
      day = n2;
    } else {
      day = n1;
      month = n2 - 1;
    }
  }

  return { year: n3, month, day };
}

/**
 * Combina fecha y hora de WhatsApp en un objeto Date válido
 * @param {string} dateStr Cadena de fecha
 * @param {string} timeStr Cadena de hora
 * @param {'DMY'|'MDY'} preferredOrder
 * @returns {Date | null}
 */
export function buildDateTime(dateStr, timeStr, preferredOrder = 'DMY') {
  const d = parseDateString(dateStr, preferredOrder);
  if (!d) return null;

  const t = parseTimeString(timeStr);
  const dateObj = new Date(d.year, d.month, d.day, t.hour, t.minute, t.second);

  if (isNaN(dateObj.getTime())) return null;
  return dateObj;
}

/**
 * Formato estándar de clave de fecha para agrupaciones por día: YYYY-MM-DD
 * @param {Date} dateObj
 * @returns {string}
 */
export function getDateKey(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return 'fecha_desconocida';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
