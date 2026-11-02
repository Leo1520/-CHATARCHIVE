/**
 * ChatArchive - Web Worker para Parseo de Conversaciones Masivas
 * Permite procesar archivos de miles de líneas sin congelar la interfaz de usuario
 */

// Importar utilidades dentro del contexto del Worker (compatible con Workers clásicos o módulos)
// Para máxima compatibilidad con navegadores móviles, el worker implementa la lógica modular de parseo
const PATTERNS = [
  /^\[(\d{1,4}[-/. ]\d{1,2}[-/. ]\d{2,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?|\s*[AP]M)?)\]\s*(.*)$/,
  /^(\d{1,4}[-/. ]\d{1,2}[-/. ]\d{2,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?|\s*[AP]M)?)\s*[-–—]\s*(.*)$/
];

const ATTACHMENT_PATTERNS = [
  /^(.+?)\s*\((?:archivo adjunto|file attached)\)$/i,
  /^<(?:adjunto|attached):\s*(.+?)>$/i,
  /^(?:imagen|video|audio|documento|sticker|contacto|tarjeta de contacto)\s+omitid[ao]/i,
  /^<(?:Media omitted|image omitted|video omitted|audio omitted|document omitted|sticker omitted)>/i
];

self.onmessage = function (e) {
  const { action, text } = e.data || {};

  if (action === 'parse') {
    try {
      const lines = text.split('\n');
      const total = lines.length;
      const messages = [];
      const participantMap = new Map();
      let mediaCount = 0;
      let currentMessage = null;

      for (let i = 0; i < total; i++) {
        const line = lines[i];

        if (i % 2500 === 0 && total > 0) {
          self.postMessage({
            type: 'progress',
            percent: Math.round((i / total) * 100),
            message: `Procesando línea ${i} de ${total}...`
          });
        }

        let matched = null;
        for (const pattern of PATTERNS) {
          const m = line.match(pattern);
          if (m) {
            matched = { dateStr: m[1], timeStr: m[2], remainder: m[3] || '' };
            break;
          }
        }

        if (matched) {
          if (currentMessage) messages.push(currentMessage);

          const colonIdx = matched.remainder.indexOf(':');
          let sender = null;
          let body = matched.remainder.trim();
          let msgType = 'system';

          if (colonIdx > 0) {
            const potentialSender = matched.remainder.substring(0, colonIdx).trim();
            if (potentialSender.length < 60) {
              sender = potentialSender;
              body = matched.remainder.substring(colonIdx + 1).trim();
              msgType = 'user';
              participantMap.set(sender, (participantMap.get(sender) || 0) + 1);
            }
          }

          let isAttachment = false;
          let attachmentName = null;

          for (let a = 0; a < ATTACHMENT_PATTERNS.length; a++) {
            const am = body.match(ATTACHMENT_PATTERNS[a]);
            if (am) {
              isAttachment = true;
              attachmentName = am[1] ? am[1].trim() : null;
              mediaCount++;
              break;
            }
          }

          currentMessage = {
            id: messages.length + 1,
            rawDate: matched.dateStr,
            rawTime: matched.timeStr,
            type: msgType,
            sender,
            text: body,
            attachment: isAttachment ? { fileName: attachmentName } : null
          };
        } else if (currentMessage) {
          currentMessage.text += '\n' + line;
        }
      }

      if (currentMessage) messages.push(currentMessage);

      const participants = Array.from(participantMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      self.postMessage({
        type: 'complete',
        result: {
          messages,
          participants,
          totalMessages: messages.length,
          mediaCount
        }
      });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message });
    }
  }
};
