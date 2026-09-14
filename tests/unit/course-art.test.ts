import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CourseArt } from '@/components/marketing/CourseArt';

/**
 * A bad row must not take down the page it appears on.
 *
 * `courses.tone` is plain `text not null default 'emerald'` with no CHECK
 * constraint, so the database will hold any string at all. The component used
 * to index its palette with that value and dereference the result immediately —
 * which turns one unexpected row into a SERVER-RENDER CRASH, and every
 * catalogue page that row appears on into "cette page n'a pas pu s'afficher".
 *
 * The same shape of fault waits on `title_ar`: the field is optional in the
 * module form now, and `.length` does not care how reasonable that was.
 *
 * A cover in the wrong colour is a blemish. A blank error page is a broken
 * site. These assertions are the difference.
 */
describe('CourseArt', () => {
  const render = (props: Parameters<typeof CourseArt>[0]) =>
    renderToStaticMarkup(CourseArt(props));

  it('draws a known tone with its own palette', () => {
    const svg = render({ titleAr: 'فقه', title: 'Fiqh', tone: 'indigo' });
    expect(svg).toContain('#2b3f8f');
    expect(svg).toContain('ca-indigo');
  });

  it('falls back instead of throwing on a tone the palette has never heard of', () => {
    // The exact thing the column permits and the type system does not.
    const svg = render({
      titleAr: 'فقه',
      title: 'Fiqh',
      tone: 'gold' as unknown as 'emerald',
    });
    expect(svg).toContain('#118866');
    // The gradient id follows the tone actually used: an id naming a colour
    // that was never defined would paint the rectangle with nothing.
    expect(svg).toContain('ca-emerald');
    expect(svg).not.toContain('ca-gold');
  });

  it('survives every empty and absent value the schema allows', () => {
    for (const tone of ['', ' ', 'EMERALD'] as unknown as 'emerald'[]) {
      expect(() => render({ titleAr: '', title: 'Fiqh', tone })).not.toThrow();
    }
  });

  it('does not crash when the Arabic title is absent', () => {
    // Optional in the form since the module form was slimmed.
    const svg = render({
      titleAr: undefined as unknown as string,
      title: 'Sciences du Coran',
      tone: 'emerald',
    });
    expect(svg).toContain('Sciences du Coran');
  });

  it('still renders the French title when everything else is empty', () => {
    const svg = render({ titleAr: '', title: 'Langue arabe', tone: 'emerald' });
    expect(svg).toContain('Langue arabe');
  });
});
