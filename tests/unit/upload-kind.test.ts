import { describe, expect, it } from 'vitest';
import { classifyUpload } from '@/lib/media/upload-kind';

const f = (name: string, type = '') => ({ name, type });

describe('classifyUpload', () => {
  it('recognises the images the deck is made of', () => {
    expect(classifyUpload(f('plan.png', 'image/png'))).toBe('image');
    expect(classifyUpload(f('photo.JPG', 'image/jpeg'))).toBe('image');
    expect(classifyUpload(f('slide.webp', 'image/webp'))).toBe('image');
  });

  it('recognises a PDF by type or by name', () => {
    expect(classifyUpload(f('cours.pdf', 'application/pdf'))).toBe('pdf');
    // Some browsers report nothing at all for a file dragged from a network drive.
    expect(classifyUpload(f('cours.PDF', ''))).toBe('pdf');
  });

  it('recognises a PowerPoint, so it can be told what to do about it', () => {
    // The point of naming this separately: "unsupported file" teaches a teacher
    // nothing, while "save it as PDF" is two clicks away inside PowerPoint.
    expect(classifyUpload(f('lecon.pptx', ''))).toBe('office');
    expect(classifyUpload(f('lecon.ppt', 'application/vnd.ms-powerpoint'))).toBe('office');
    expect(classifyUpload(f('lecon.odp', ''))).toBe('office');
    expect(classifyUpload(f('lecon.key', ''))).toBe('office');
    expect(classifyUpload(f('notes.docx', ''))).toBe('office');
  });

  it('falls back to the extension when the browser declares nothing', () => {
    expect(classifyUpload(f('scan.jpeg', ''))).toBe('image');
    expect(classifyUpload(f('scan.PNG', 'application/octet-stream'))).toBe('image');
  });

  it('refuses anything else', () => {
    expect(classifyUpload(f('cours.mp4', 'video/mp4'))).toBe('unsupported');
    expect(classifyUpload(f('archive.zip', 'application/zip'))).toBe('unsupported');
    expect(classifyUpload(f('payload.html', 'text/html'))).toBe('unsupported');
    expect(classifyUpload(f('noextension', ''))).toBe('unsupported');
  });
});
