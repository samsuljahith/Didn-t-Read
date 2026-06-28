import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** @param {string} html @param {string} url */
export function makeDocument(html, url = 'https://example.com/') {
  const dom = new JSDOM(html, { url });
  return dom.window.document;
}

/** @param {Document} doc */
export function loadScoreLegalDoc(doc) {
  const win = doc.defaultView;
  const context = {
    document: doc,
    window: win,
    location: win.location,
    URL: win.URL,
    Node: win.Node,
    DOMParser: win.DOMParser,
    NodeFilter: win.NodeFilter,
    globalThis: win,
  };

  vm.createContext(context);
  vm.runInContext(readFileSync(join(ROOT, 'lib/extract-html.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(ROOT, 'content/detector.js'), 'utf8'), context);
  return context.scoreLegalDoc;
}

/** @param {number} [paragraphs] */
export function legalBoilerplate(paragraphs = 120) {
  const sentence =
    'We collect personal data you provide. You agree to our governing law and third party sharing rules. ' +
    'You may opt out where applicable. The data controller processes retention and lawful basis for consent.';
  return Array(paragraphs).fill(`<p>${sentence}</p>`).join('\n');
}

export const FIXTURES = {
  privacyDocument: (() => {
    const body = legalBoilerplate();
    return `<!DOCTYPE html><html><head><title>Privacy Policy — Example Co</title></head>
      <body><main><h1>Privacy Policy</h1>${body}</main></body></html>`;
  })(),

  termsDocument: (() => {
    const body = legalBoilerplate();
    return `<!DOCTYPE html><html><head><title>Terms of Service</title></head>
      <body><article><h1>Terms of Service</h1>${body}</article></body></html>`;
  })(),

  cookieDocument: (() => {
    const body = legalBoilerplate(80);
    return `<!DOCTYPE html><html><head><title>Cookie Policy</title></head>
      <body><main><h1>Cookie Policy</h1><p>We use strictly necessary cookies and analytics cookies with your consent.</p>${body}</main></body></html>`;
  })(),

  legalHub: `
    <!DOCTYPE html><html><head><title>Example Co — Home</title></head>
    <body>
      <main><h1>Welcome to Example Co</h1><p>We build great products for teams.</p></main>
      <footer>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
        <a href="/cookies">Cookie Policy</a>
      </footer>
    </body></html>`,

  blogPost: (() => {
    const paras = Array(40)
      .fill('<p>Today we explore sourdough starters, hydration ratios, and oven spring for home bakers.</p>')
      .join('');
    return `<!DOCTYPE html><html><head><title>Best Sourdough Tips</title></head>
      <body><article><h1>Best Sourdough Tips</h1>${paras}</article></body></html>`;
  })(),

  productPage: `
    <!DOCTYPE html><html><head><title>Wireless Headphones — Shop</title></head>
    <body>
      <main>
        <h1>Wireless Headphones Pro</h1>
        <p>40-hour battery. Free shipping on orders over $50.</p>
        <button>Add to cart</button>
      </main>
    </body></html>`,
};
