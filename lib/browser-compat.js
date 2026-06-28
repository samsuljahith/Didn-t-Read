(function () {
  const api = typeof globalThis.browser !== 'undefined' ? globalThis.browser : globalThis.chrome;
  globalThis.extApi = api;
  globalThis.isFirefox =
    typeof globalThis.browser !== 'undefined' &&
    typeof globalThis.chrome?.sidePanel === 'undefined';
})();
