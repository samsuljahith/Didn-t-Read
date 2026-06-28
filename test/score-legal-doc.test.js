import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES, loadScoreLegalDoc, makeDocument } from './helpers.js';

describe('scoreLegalDoc()', () => {
  it('classifies a full privacy policy page as legal document mode', () => {
    const doc = makeDocument(FIXTURES.privacyDocument, 'https://example.com/privacy');
    const score = loadScoreLegalDoc(doc)(doc);

    assert.equal(score.isLegal, true);
    assert.equal(score.type, 'privacy');
    assert.equal(score.mode, 'document');
    assert.ok(score.confidence >= 0.55);
    assert.ok(score.wordCount >= 800);
    assert.equal(score.needsConfirmation, false);
  });

  it('classifies a terms of service page as legal document mode', () => {
    const doc = makeDocument(FIXTURES.termsDocument, 'https://example.com/terms-of-service');
    const score = loadScoreLegalDoc(doc)(doc);

    assert.equal(score.isLegal, true);
    assert.equal(score.type, 'terms');
    assert.equal(score.mode, 'document');
    assert.ok(score.wordCount >= 800);
  });

  it('classifies a cookie policy page as cookies type', () => {
    const doc = makeDocument(FIXTURES.cookieDocument, 'https://example.com/cookie-policy');
    const score = loadScoreLegalDoc(doc)(doc);

    assert.equal(score.isLegal, true);
    assert.equal(score.type, 'cookies');
    assert.equal(score.mode, 'document');
  });

  it('classifies a homepage with footer legal links as hub mode', () => {
    const doc = makeDocument(FIXTURES.legalHub, 'https://example.com/');
    const score = loadScoreLegalDoc(doc)(doc);

    assert.equal(score.isLegal, true);
    assert.equal(score.mode, 'hub');
    assert.ok(score.linkedPolicies.length >= 2);
    assert.ok(score.wordCount < 800);
    assert.ok(score.hubScore > score.documentScore);
  });

  it('does not classify a cooking blog as a legal document', () => {
    const doc = makeDocument(FIXTURES.blogPost, 'https://example.com/blog/sourdough-tips');
    const score = loadScoreLegalDoc(doc)(doc);

    assert.equal(score.type, 'unknown');
    assert.equal(score.mode, 'unknown');
    assert.equal(score.isLegal, false);
    assert.equal(score.blockReason, 'not_a_legal_page');
    assert.ok(score.linkedPolicies.length === 0);
  });

  it('does not classify a product page as legal', () => {
    const doc = makeDocument(FIXTURES.productPage, 'https://shop.example.com/headphones');
    const score = loadScoreLegalDoc(doc)(doc);

    assert.equal(score.type, 'unknown');
    assert.equal(score.mode, 'unknown');
    assert.equal(score.isLegal, false);
    assert.equal(score.blockReason, 'not_a_legal_page');
    assert.ok(score.legalDensity < 1);
  });

  it('finds same-origin policy links on hub pages', () => {
    const doc = makeDocument(FIXTURES.legalHub, 'https://example.com/');
    const score = loadScoreLegalDoc(doc)(doc);

    const privacy = score.linkedPolicies.find((l) => l.type === 'privacy');
    assert.ok(privacy);
    assert.equal(privacy.sameOrigin, true);
    assert.ok(privacy.inFooter);
    assert.equal(privacy.href, 'https://example.com/privacy');
  });
});
