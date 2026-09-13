'use client';

/**
 * A PDF becomes a stack of images, in the teacher's own browser.
 *
 * The alternative was storing the PDF and rendering it in every viewer's
 * browser — a PDF engine shipped to forty students, the whole document fetched
 * for each of them, and a second kind of slide for the student side to learn.
 * Converting once, at upload, keeps the rule that a slide is an image, so the
 * byte sniffing, the database constraints and the student's page are untouched.
 *
 * Two things here are the result of this failing in production rather than of
 * taste:
 *
 *   * The WORKER is constructed explicitly, as a module worker. pdf.js ships an
 *     ESM worker and, left to load it itself, it can start one as a classic
 *     worker — which fails to parse the moment it meets `import`, and surfaces
 *     as "this PDF could not be read" about a PDF that is perfectly fine. If
 *     the browser will not give us a module worker at all, we fall back to
 *     running on the main thread, which is slower and always works.
 *
 *   * Errors are not flattened. A password, a corrupt file and a worker that
 *     would not start are three different problems with three different things
 *     for the teacher to do, and the caller is told which.
 */

import type * as PdfJs from 'pdfjs-dist';

/** Wide enough to read a dense slide full-screen, small enough to upload quickly. */
const TARGET_WIDTH = 1600;

export interface PdfProgress {
  page: number;
  pages: number;
}

/** Why a PDF could not be turned into slides. Distinct on purpose. */
export type PdfFailure = 'password' | 'corrupt' | 'engine' | 'empty';

export class PdfError extends Error {
  constructor(
    readonly reason: PdfFailure,
    readonly detail: string,
  ) {
    super(detail);
    this.name = 'PdfError';
  }
}

type PdfModule = typeof PdfJs;

/**
 * Load the engine.
 *
 * The legacy build is deliberate: it avoids the newest syntax, so a teacher on
 * a browser a year or two old gets slides rather than a blank error.
 */
async function loadEngine(): Promise<PdfModule> {
  return (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfModule;
}

/**
 * Give the engine somewhere to run, and be willing to be wrong about where.
 *
 * pdf.js ships an ESM worker. Whether a module worker can be started from a
 * bundled URL depends on the bundler, the browser and the page's own headers —
 * three things that can each change without us touching this file, and whose
 * failure looked exactly like a broken PDF. So the worker is an attempt, not an
 * assumption: `openDocument` below falls back to running inline the moment the
 * worker turns out not to be usable, and the teacher sees slides either way.
 */
function startWorker(pdfjs: PdfModule): boolean {
  try {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url),
      { type: 'module' },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Run the engine on the main thread instead.
 *
 * Importing the worker bundle registers it globally, and pdf.js then uses it
 * without a Worker at all. The tab is busy while a deck converts — which is a
 * few seconds at upload time, and is the right trade against refusing the file.
 */
async function runInline(pdfjs: PdfModule): Promise<void> {
  pdfjs.GlobalWorkerOptions.workerPort = null;
  pdfjs.GlobalWorkerOptions.workerSrc = '';
  await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
}

/** A file problem is the teacher's to fix; anything else is worth retrying inline. */
function fileProblem(thrown: unknown): PdfFailure | null {
  const name = (thrown as { name?: string })?.name ?? '';
  if (name === 'PasswordException') return 'password';
  if (name === 'InvalidPDFException') return 'corrupt';
  return null;
}

async function openDocument(pdfjs: PdfModule, data: Uint8Array) {
  const load = () =>
    pdfjs.getDocument({
      // A fresh copy each attempt: pdf.js transfers the buffer to its worker,
      // which leaves the original detached and the retry reading zero bytes.
      data: data.slice(),
      // Nothing about rasterising a page needs the network, and a document
      // that reaches for it is not one to indulge.
      useWorkerFetch: false,
    });

  let task = load();
  try {
    return { task, document_: await task.promise };
  } catch (thrown) {
    const problem = fileProblem(thrown);
    await task.destroy().catch(() => {});
    if (problem) throw new PdfError(problem, describe(thrown));

    // Not the file, then. Almost always the worker: retry on the main thread,
    // where there is no URL to resolve and nothing for a browser to refuse.
    await runInline(pdfjs);
    task = load();
    try {
      return { task, document_: await task.promise };
    } catch (second) {
      await task.destroy().catch(() => {});
      throw new PdfError(fileProblem(second) ?? 'engine', describe(second));
    }
  }
}

export async function pdfToImages(
  file: File,
  options: { maxPages?: number; onProgress?: (progress: PdfProgress) => void } = {},
): Promise<File[]> {
  let pdfjs: PdfModule;
  try {
    pdfjs = await loadEngine();
    startWorker(pdfjs);
  } catch (thrown) {
    throw new PdfError('engine', describe(thrown));
  }

  const { task, document_ } = await openDocument(pdfjs, new Uint8Array(await file.arrayBuffer()));

  const pages = Math.min(document_.numPages, options.maxPages ?? 200);
  if (pages === 0) {
    await task.destroy().catch(() => {});
    throw new PdfError('empty', 'no pages');
  }

  const baseName = file.name.replace(/\.pdf$/i, '');
  const out: File[] = [];

  try {
    for (let n = 1; n <= pages; n += 1) {
      options.onProgress?.({ page: n, pages });

      const page = await document_.getPage(n);
      const unscaled = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: TARGET_WIDTH / unscaled.width });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new PdfError('engine', 'no 2d canvas context');

      // White behind the page: a PDF with a transparent background would
      // otherwise come out as black text on black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, viewport }).promise;

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        out.push(
          new File([blob], `${baseName}-${String(n).padStart(2, '0')}.png`, { type: 'image/png' }),
        );
      }
      page.cleanup();
    }
  } catch (thrown) {
    if (thrown instanceof PdfError) throw thrown;
    throw new PdfError('engine', describe(thrown));
  } finally {
    // The loading task, not the document: `destroy()` is what shuts the worker
    // down, and one left running per upload accumulates.
    await task.destroy().catch(() => {});
  }

  return out;
}

function describe(thrown: unknown): string {
  if (thrown instanceof Error) return `${thrown.name}: ${thrown.message}`;
  return String(thrown);
}
