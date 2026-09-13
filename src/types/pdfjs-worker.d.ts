/**
 * The pdf.js worker, imported for its side effects.
 *
 * Only reached when a browser refuses a module worker: importing the worker
 * bundle registers it globally and pdf.js then runs it on the main thread. It
 * ships no typings of its own, and it exports nothing worth typing.
 */
declare module 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
