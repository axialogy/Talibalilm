'use client';

import { useCallback, useRef, useState } from 'react';
import { confirmSlide, requestSlideUpload } from '@/app/actions/slides';
import { MAX_IMAGE_BYTES } from '@/lib/media/image';
import { classifyUpload } from '@/lib/media/upload-kind';
import { PdfError } from '@/lib/media/pdf';

/**
 * Adding slides, from either the preparation screen or the room.
 *
 * One hook so the two surfaces cannot drift: the same formats, the same
 * refusals, the same two-step upload. A teacher who learns it before the lesson
 * does not learn it again during one.
 *
 * A PDF is expanded into one image per page before anything is uploaded. That
 * is deliberate and it is where the whole design holds together — the server
 * still only ever accepts a PNG, JPEG or WebP, so the byte sniffing and the
 * database constraints did not have to be relaxed to gain a feature.
 */
export interface SlideUploadState {
  /** Files currently in flight, and which page of a PDF is being converted. */
  busy: number;
  converting: { page: number; pages: number } | null;
  error: string | null;
  /**
   * The underlying exception, when there is one.
   *
   * Shown to the teacher because the alternative has cost several rounds: a
   * single "could not be read" stood for a password, a corrupt file and a
   * worker that would not start, and only one of those was ever true.
   */
  detail: string | null;
  clearError: () => void;
  upload: (files: FileList | File[]) => Promise<void>;
}

export interface SlideUploadHandlers {
  /** The deck needs re-reading from the server (the admin preparation screen). */
  onDone?: () => void;
  /**
   * One slide landed, with its position in this batch. The room uses this to
   * put the new page in front of the class the moment it is up, without
   * rebuilding the page a lesson is happening on.
   */
  onAdded?: (slide: { id: string; url: string | null; filename: string }, index: number) => void;
}

export function useSlideUpload(
  sessionId: string,
  handlers: SlideUploadHandlers = {},
): SlideUploadState {
  const [busy, setBusy] = useState(0);
  const [converting, setConverting] = useState<{ page: number; pages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const addedRef = useRef(false);
  // Kept in refs so `upload` is not rebuilt — and cannot go stale — every time
  // the caller re-renders.
  const onDoneRef = useRef(handlers.onDone);
  onDoneRef.current = handlers.onDone;
  const onAddedRef = useRef(handlers.onAdded);
  onAddedRef.current = handlers.onAdded;

  const putOne = useCallback(
    async (file: File): Promise<{ id: string; url: string | null; filename: string } | null> => {
      try {
        if (file.size > MAX_IMAGE_BYTES) {
          setError('tooLarge');
          return null;
        }
        const ticket = await requestSlideUpload({
          sessionId,
          contentType: file.type,
          byteSize: file.size,
        });
        if (!ticket.ok || !ticket.url || !ticket.key) {
          setError(ticket.error ?? 'uploadFailed');
          return null;
        }

        const put = await fetch(ticket.url, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': ticket.contentType ?? file.type },
        });
        if (!put.ok) {
          setError('uploadFailed');
          return null;
        }

        const done = await confirmSlide({ sessionId, key: ticket.key, filename: file.name });
        if (!done.ok || !done.slide) {
          setError(done.error ?? 'uploadFailed');
          return null;
        }
        addedRef.current = true;
        return done.slide;
      } catch (thrown) {
        // A rejected fetch — a CORS refusal, a dropped connection — arrives
        // with no status and only the browser's own words. This is an UPLOAD
        // failure; without this catch it escaped to the PDF branch, which
        // relabelled it "conversion failed" and sent the office to the wrong
        // problem. The origin is included because a bucket's CORS rule is
        // written against exactly that string.
        setError('uploadFailed');
        setDetail(
          `${
            thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown)
          } (origine ${window.location.origin})`,
        );
        return null;
      }
    },
    [sessionId],
  );

  const upload = useCallback(
    async (input: FileList | File[]) => {
      setError(null);
      setDetail(null);
      addedRef.current = false;
      const chosen = Array.from(input);
      let added = 0;

      for (const file of chosen) {
        const kind = classifyUpload(file);

        if (kind === 'office') {
          // Named rather than lumped in with "unsupported": rendering a .pptx
          // faithfully needs LibreOffice on a server, which this platform
          // deliberately does not have, and PowerPoint exports to PDF in two
          // clicks. Saying which two is worth more than a refusal.
          setError('convertToPdf');
          continue;
        }
        if (kind === 'unsupported') {
          setError('notAnImage');
          continue;
        }

        setBusy((n) => n + 1);
        try {
          if (kind === 'pdf') {
            const { pdfToImages } = await import('@/lib/media/pdf');
            const pages = await pdfToImages(file, {
              onProgress: (progress) => setConverting(progress),
            });
            setConverting(null);
            if (pages.length === 0) {
              setError('pdfEmpty');
              continue;
            }
            for (const page of pages) {
              const slide = await putOne(page);
              if (slide) onAddedRef.current?.(slide, added++);
            }
          } else {
            const slide = await putOne(file);
            if (slide) onAddedRef.current?.(slide, added++);
          }
        } catch (thrown) {
          setConverting(null);
          if (thrown instanceof PdfError) {
            // Three different problems with three different things to do about
            // them; saying "could not be read" for all three helps nobody.
            setError(
              thrown.reason === 'password'
                ? 'pdfPassword'
                : thrown.reason === 'corrupt'
                  ? 'pdfCorrupt'
                  : thrown.reason === 'empty'
                    ? 'pdfEmpty'
                    : 'pdfEngine',
            );
            setDetail(thrown.detail);
          } else {
            setError(kind === 'pdf' ? 'pdfEngine' : 'uploadFailed');
            setDetail(
              thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown),
            );
          }
        } finally {
          setBusy((n) => n - 1);
        }
      }

      // Nothing added, nothing to refresh.
      if (addedRef.current) onDoneRef.current?.();
    },
    [putOne],
  );

  return {
    busy,
    converting,
    error,
    detail,
    clearError: () => {
      setError(null);
      setDetail(null);
    },
    upload,
  };
}
