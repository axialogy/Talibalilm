/**
 * What a teacher just dropped on the slide uploader.
 *
 * Pure, and separated from the conversion, because the interesting decision is
 * not "how do we render a PDF" but "which of these four things is this, and
 * what do we tell them" — and that deserves tests without a canvas.
 *
 * The extension is checked as well as the declared type. A browser reports
 * `application/vnd.openxmlformats-officedocument.presentationml.presentation`
 * for a .pptx on a good day and an empty string on a bad one, and a teacher
 * whose PowerPoint is silently called "unsupported file" learns nothing.
 */
export type UploadKind = 'image' | 'pdf' | 'office' | 'unsupported';

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const OFFICE_EXTENSIONS = ['.ppt', '.pptx', '.odp', '.key', '.doc', '.docx'];

export function classifyUpload(file: { name: string; type: string }): UploadKind {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (IMAGE_TYPES.has(type)) return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (OFFICE_EXTENSIONS.some((ext) => name.endsWith(ext))) return 'office';
  // A type the browser did not recognise, but a name we do.
  if (/\.(png|jpe?g|webp)$/.test(name)) return 'image';
  return 'unsupported';
}
