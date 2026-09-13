'use client';

/**
 * A PDF becomes a stack of images, in the teacher's own browser.
 *
 * The alternative was storing the PDF and rendering it in every viewer's
 * browser, which would have meant shipping a PDF engine to forty students,
 * fetching the whole document for each of them, and teaching the student side
 * about a second kind of slide. Converting once, at upload, keeps the rule
 * that a slide is an image — so the byte sniffing, the database constraints
 * and the student's page all stay exactly as they were.
 *
 * It also keeps the promise about infrastructure: no server-side conversion, no
 * LibreOffice, nothing to run. The teacher's laptop does the work once.
 *
 * pdf.js is imported dynamically so a megabyte of PDF engine is not in the
 * bundle of every page for the sake of the rare upload that needs it.
 */

/** Wide enough to read a dense slide full-screen, small enough to upload quickly. */
const TARGET_WIDTH = 1600;

export interface PdfProgress {
  page: number;
  pages: number;
}

export async function pdfToImages(
  file: File,
  options: { maxPages?: number; onProgress?: (progress: PdfProgress) => void } = {},
): Promise<File[]> {
  const pdfjs = await import('pdfjs-dist');
  // The worker keeps rendering off the main thread; without it a long deck
  // freezes the room while the teacher is standing in front of a class.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  // The loading task, not just the document: `destroy()` is what shuts the
  // worker down, and a worker left running per upload accumulates.
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const document_ = await task.promise;
  const pages = Math.min(document_.numPages, options.maxPages ?? 200);
  const baseName = file.name.replace(/\.pdf$/i, '');
  const out: File[] = [];

  for (let n = 1; n <= pages; n += 1) {
    options.onProgress?.({ page: n, pages });

    const page = await document_.getPage(n);
    const unscaled = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: TARGET_WIDTH / unscaled.width });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) break;

    // White behind the page: a PDF with a transparent background would
    // otherwise come out as black text on black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) {
      out.push(
        new File([blob], `${baseName}-${String(n).padStart(2, '0')}.png`, { type: 'image/png' }),
      );
    }
    page.cleanup();
  }

  await task.destroy();
  return out;
}
