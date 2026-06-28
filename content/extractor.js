/**
 * @param {Document} [doc]
 * @returns {{ text: string; wordCount: number; title: string }}
 */
function extractDocumentText(doc = document) {
  return extractDocumentFromDoc(doc);
}
