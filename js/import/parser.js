/**
 * ChatArchive - Parser Modular y Robusto de Conversaciones de WhatsApp
 * Compatible con múltiples formatos de fecha/hora (Android, iOS, 12h/24h, multilínea y multimedia)
 */

import { buildDateTime, getDateKey } from '../utils/dates.js';
import { detectMediaType, sanitizeFileName } from '../utils/validation.js';

/**
 * Patrones principales de inicio de línea de WhatsApp
 */
const PATTERNS = [
  // 1. Formato iOS con corchetes: [DD/MM/YY, HH:MM:SS] o [DD/MM/YYYY, HH:MM:SS a. m.]
  {
    name: 'ios_brackets',
    regex: /^\[(\d{1,4}[-/. ]\d{1,2}[-/. ]\d{2,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?|\s*[AP]M)?)\]\s*(.*)$/
  },
  // 2. Formato Android clásico con guión: DD/MM/YY, HH:MM - o DD/MM/YYYY, H:MM p. m. -
  {
    name: 'android_dash',
    regex: /^(\d{1,4}[-/. ]\d{1,2}[-/. ]\d{2,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?|\s*[AP]M)?)\s*[-–—]\s*(.*)$/
  }
];

/**
 * Patrones para identificar referencias a archivos adjuntos en el cuerpo del mensaje
 */
const ATTACHMENT_PATTERNS = [
  // Formato Android en español: "foto.jpg (archivo adjunto)"
  /^(.+?)\s*\((?:archivo adjunto|file attached)\)$/i,
  // Formato iOS: "<adjunto: foto.jpg>" o "<attached: photo.jpg>"
  /^<(?:adjunto|attached):\s*(.+?)>$/i,
  // Formatos omitidos de WhatsApp
  /^(?:imagen|video|audio|documento|sticker|contacto|tarjeta de contacto)\s+omitid[ao]/i,
  /^<(?:Media omitted|image omitted|video omitted|audio omitted|document omitted|sticker omitted)>/i
];

/**
 * Palabras clave frecuentes para clasificar mensajes de sistema
 */
const SYSTEM_MESSAGE_KEYWORDS = [
  'cifrados de extremo a extremo',
  'end-to-end encrypted',
  'creó este grupo',
  'creaste este grupo',
  'cambió el asunto',
  'cambió la descripción',
  'cambió el ícono',
  'cambió el icono',
  'cambió a',
  'salió del grupo',
  'se unió usando el enlace',
  'añadió a',
  'eliminó a',
  'mensajes temporales',
  'código de seguridad cambió',
  'número de teléfono cambió'
];

export class WhatsAppParser {
  /**
   * Parsea el texto completo de una conversación de WhatsApp
   * @param {string} fullText Texto normalizado del archivo
   * @param {Function} onProgress Callback de progreso porcentual (0 - 100)
   * @returns {{
   *   messages: Array<Object>,
   *   participants: Array<{ name: string, count: number }>,
   *   totalMessages: number,
   *   firstDate: Date | null,
   *   lastDate: Date | null,
   *   mediaCount: number
   * }}
   */
  static parse(fullText, onProgress = () => {}) {
    if (!fullText || typeof fullText !== 'string') {
      return {
        messages: [],
        participants: [],
        totalMessages: 0,
        firstDate: null,
        lastDate: null,
        mediaCount: 0
      };
    }

    const lines = fullText.split('\n');
    const totalLines = lines.length;
    const messages = [];
    const participantMap = new Map(); // name -> count
    let mediaCounter = 0;

    let currentMessage = null;

    for (let i = 0; i < totalLines; i++) {
      const line = lines[i];

      // Emitir progreso cada 1000 líneas
      if (i % 1000 === 0 && totalLines > 0) {
        const pct = Math.round((i / totalLines) * 100);
        onProgress(pct, `Interpretando mensaje ${i} de ${totalLines}...`);
      }

      // 1. Intentar hacer coincidir con un nuevo encabezado de mensaje
      const headerMatch = matchMessageHeader(line);

      if (headerMatch) {
        // Guardar el mensaje anterior completado
        if (currentMessage) {
          messages.push(currentMessage);
        }

        const { dateStr, timeStr, remainder } = headerMatch;
        const dateTime = buildDateTime(dateStr, timeStr);
        const dateKey = dateTime ? getDateKey(dateTime) : 'fecha_desconocida';

        // 2. Analizar el remitente y el contenido
        const parsedBody = parseSenderAndBody(remainder);

        // 3. Detectar si contiene archivo adjunto
        const attachmentInfo = detectAttachment(parsedBody.text);
        if (attachmentInfo.isAttachment) {
          mediaCounter++;
        }

        // 4. Contabilizar participante si no es mensaje de sistema
        if (parsedBody.type === 'user' && parsedBody.sender) {
          const currentCount = participantMap.get(parsedBody.sender) || 0;
          participantMap.set(parsedBody.sender, currentCount + 1);
        }

        currentMessage = {
          id: messages.length + 1,
          date: dateTime,
          dateKey,
          rawDate: dateStr,
          rawTime: timeStr,
          type: parsedBody.type,
          sender: parsedBody.sender,
          text: parsedBody.text,
          attachment: attachmentInfo.isAttachment ? attachmentInfo : null
        };
      } else {
        // 5. Es una línea multilínea perteneciente al mensaje actual
        if (currentMessage) {
          currentMessage.text += '\n' + line;
        } else if (line.trim().length > 0) {
          // Línea al inicio del archivo sin formato identificable (conservar sin descartar)
          currentMessage = {
            id: messages.length + 1,
            date: null,
            dateKey: 'desconocido',
            rawDate: '',
            rawTime: '',
            type: 'system',
            sender: null,
            text: line,
            attachment: null
          };
        }
      }
    }

    // Agregar el último mensaje procesado
    if (currentMessage) {
      messages.push(currentMessage);
    }

    onProgress(100, 'Interpretación finalizada.');

    // Calcular metadatos globales
    const participants = Array.from(participantMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const validDates = messages.map(m => m.date).filter(Boolean);
    const firstDate = validDates.length > 0 ? validDates[0] : null;
    const lastDate = validDates.length > 0 ? validDates[validDates.length - 1] : null;

    return {
      messages,
      participants,
      totalMessages: messages.length,
      firstDate,
      lastDate,
      mediaCount: mediaCounter
    };
  }
}

/**
 * Intenta hacer coincidir una línea con alguno de los patrones de inicio de WhatsApp
 * @param {string} line
 * @returns {{ dateStr: string, timeStr: string, remainder: string } | null}
 */
export function matchMessageHeader(line) {
  if (!line || line.length < 8) return null;

  for (const pattern of PATTERNS) {
    const match = line.match(pattern.regex);
    if (match) {
      return {
        dateStr: match[1],
        timeStr: match[2],
        remainder: match[3] || ''
      };
    }
  }

  return null;
}

/**
 * Separa el remitente del cuerpo del mensaje o clasifica como mensaje de sistema
 * @param {string} remainder Parte posterior a la fecha y hora
 * @returns {{ sender: string | null, text: string, type: 'user' | 'system' }}
 */
export function parseSenderAndBody(remainder) {
  if (!remainder) {
    return { sender: null, text: '', type: 'system' };
  }

  // Si contiene dos puntos ":", posiblemente separa al remitente del mensaje
  // Ejemplo: "Carlos: Hola qué tal"
  const colonIndex = remainder.indexOf(':');

  if (colonIndex > 0) {
    const possibleSender = remainder.substring(0, colonIndex).trim();
    const possibleText = remainder.substring(colonIndex + 1).trim();

    // Validar que el remitente no sea una advertencia de sistema larga
    if (possibleSender.length < 60 && !isKnownSystemKeyword(possibleSender)) {
      return {
        sender: possibleSender,
        text: possibleText,
        type: 'user'
      };
    }
  }

  // Es un mensaje del sistema
  return {
    sender: null,
    text: remainder.trim(),
    type: 'system'
  };
}

/**
 * Detecta si el texto del mensaje referencia un archivo adjunto
 * @param {string} text
 * @returns {{ isAttachment: boolean, fileName: string | null, mediaType: string, isOmitted: boolean }}
 */
export function detectAttachment(text) {
  if (!text) {
    return { isAttachment: false, fileName: null, mediaType: 'unknown', isOmitted: false };
  }

  const clean = text.trim();

  // 1. Adjunto con nombre de archivo explícito
  for (let i = 0; i < 2; i++) {
    const match = clean.match(ATTACHMENT_PATTERNS[i]);
    if (match && match[1]) {
      const fileName = sanitizeFileName(match[1]);
      return {
        isAttachment: true,
        fileName,
        mediaType: detectMediaType(fileName),
        isOmitted: false
      };
    }
  }

  // 2. Adjunto marcado como omitido por WhatsApp
  for (let i = 2; i < ATTACHMENT_PATTERNS.length; i++) {
    if (ATTACHMENT_PATTERNS[i].test(clean)) {
      return {
        isAttachment: true,
        fileName: null,
        mediaType: 'unknown',
        isOmitted: true
      };
    }
  }

  return { isAttachment: false, fileName: null, mediaType: 'unknown', isOmitted: false };
}

/**
 * Comprueba si una cadena contiene frases típicas de eventos de sistema
 * @param {string} text
 * @returns {boolean}
 */
export function isKnownSystemKeyword(text) {
  const lower = text.toLowerCase();
  return SYSTEM_MESSAGE_KEYWORDS.some(kw => lower.includes(kw));
}
