/**
 * ChatArchive - Web Worker de Búsqueda Avanzada
 * Búsqueda optimizada insensible a mayúsculas y acentos sin congelar la UI
 */

/**
 * Normaliza una cadena eliminando marcas diacríticas (acentos) y pasando a minúsculas
 * @param {string} str
 * @returns {string}
 */
function normalizeText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Genera un fragmento de texto (snippet) con el contexto alrededor de la coincidencia
 * @param {string} fullText Texto completo del mensaje
 * @param {string} query Término de búsqueda normalizado
 * @param {number} maxLen Longitud máxima del fragmento
 * @returns {string}
 */
function generateSnippet(fullText, query, maxLen = 120) {
  if (!fullText) return '';
  const normFull = normalizeText(fullText);
  const matchIdx = normFull.indexOf(query);

  if (matchIdx === -1) {
    return fullText.length > maxLen ? fullText.substring(0, maxLen) + '...' : fullText;
  }

  const start = Math.max(0, matchIdx - 35);
  const end = Math.min(fullText.length, matchIdx + query.length + 55);

  let snippet = fullText.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < fullText.length) snippet = snippet + '...';

  return snippet;
}

self.onmessage = function (e) {
  const { action, query, messages, senderFilter, dateFilter } = e.data || {};

  if (action === 'search') {
    try {
      const normalizedQuery = normalizeText(query);
      const normalizedSender = senderFilter ? normalizeText(senderFilter) : null;
      const normalizedDate = dateFilter ? normalizeText(dateFilter) : null;

      if (!normalizedQuery && !normalizedSender && !normalizedDate) {
        return self.postMessage({ type: 'complete', results: [], total: 0 });
      }

      const results = [];
      const totalMessages = messages.length;

      for (let i = 0; i < totalMessages; i++) {
        const msg = messages[i];
        if (msg.type === 'system') continue;

        // Filtro por participante si está activo
        if (normalizedSender && msg.sender) {
          if (!normalizeText(msg.sender).includes(normalizedSender)) {
            continue;
          }
        }

        // Filtro por fecha si está activo
        if (normalizedDate) {
          const dateMatch = (msg.dateKey && msg.dateKey.includes(normalizedDate)) || 
                            (msg.rawDate && normalizeText(msg.rawDate).includes(normalizedDate));
          if (!dateMatch) {
            continue;
          }
        }

        // Búsqueda en el cuerpo del texto
        let matchFound = false;
        if (normalizedQuery) {
          const normText = normalizeText(msg.text);
          if (normText.includes(normalizedQuery)) {
            matchFound = true;
          }
        } else {
          // Si solo filtró por participante o fecha
          matchFound = true;
        }

        if (matchFound) {
          results.push({
            id: msg.id,
            index: msg.index !== undefined ? msg.index : i,
            sender: msg.sender,
            dateKey: msg.dateKey,
            rawDate: msg.rawDate,
            rawTime: msg.rawTime,
            text: msg.text,
            snippet: generateSnippet(msg.text, normalizedQuery)
          });
        }
      }

      self.postMessage({
        type: 'complete',
        results,
        total: results.length
      });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message });
    }
  }
};
