/** Approximate tokens as words * 1.3 */
const WORDS_PER_TOKEN = 0.75;

/**
 * @param {string} text
 * @param {number} maxTokens
 * @param {number} [overlapRatio]
 * @returns {{ index: number; total: number; text: string }[]}
 */
function chunkText(text, maxTokens, overlapRatio = 0.12) {
  const maxWords = Math.floor(maxTokens * WORDS_PER_TOKEN);
  const overlapWords = Math.floor(maxWords * overlapRatio);
  const paragraphs = text.split(/\n\n+|\n(?=#{1,6}\s)/).filter((p) => p.trim());

  if (!paragraphs.length) {
    return [{ index: 0, total: 1, text }];
  }

  const chunks = [];
  let current = [];
  let currentWords = 0;

  const flush = () => {
    if (!current.length) {
      return;
    }
    chunks.push(current.join('\n\n'));
    const overlapParas = [];
    let words = 0;
    for (let i = current.length - 1; i >= 0 && words < overlapWords; i--) {
      overlapParas.unshift(current[i]);
      words += current[i].split(/\s+/).length;
    }
    current = overlapParas;
    currentWords = words;
  };

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).length;
    if (paraWords > maxWords) {
      flush();
      const sentences = para.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        const sw = sentence.split(/\s+/).length;
        if (currentWords + sw > maxWords && current.length) {
          flush();
        }
        current.push(sentence);
        currentWords += sw;
      }
      continue;
    }

    if (currentWords + paraWords > maxWords && current.length) {
      flush();
    }
    current.push(para);
    currentWords += paraWords;
  }

  flush();

  const total = chunks.length || 1;
  return (chunks.length ? chunks : [text]).map((t, index) => ({ index, total, text: t }));
}

/**
 * @param {import('../types.js').StructuredSummary[]} partials
 * @param {number} maxTokens
 */
function partialsFitInContext(partials, maxTokens) {
  const serialized = JSON.stringify(partials);
  const approxTokens = serialized.split(/\s+/).length / WORDS_PER_TOKEN;
  return approxTokens < maxTokens * 0.6;
}
