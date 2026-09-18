import { describe, expect, it } from 'vitest';
import { malformedR2Config } from '@/lib/storage/r2-config';

const ACCOUNT = 'ea9a936fe449dbb2f4bcb856a96c0c85';

describe('malformedR2Config — values that cannot be right', () => {
  it('accepts the shapes Cloudflare hands out', () => {
    expect(malformedR2Config(ACCOUNT, 'talibalilm')).toEqual([]);
    expect(malformedR2Config(ACCOUNT.toUpperCase(), 'talibalilm')).toEqual([]);
  });

  it('names an account id that is a URL — the production bug this was written for', () => {
    expect(
      malformedR2Config(`https://${ACCOUNT}.r2.cloudflarestorage.com/talibalilm`, 'talibalilm'),
    ).toEqual(['R2_ACCOUNT_ID']);
  });

  it('names an account id of the wrong length or alphabet', () => {
    expect(malformedR2Config('ea9a936f', 'talibalilm')).toEqual(['R2_ACCOUNT_ID']);
    expect(malformedR2Config('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz', 'talibalilm')).toEqual([
      'R2_ACCOUNT_ID',
    ]);
  });

  it('names a bucket that carries a URL, a slash or a port', () => {
    expect(malformedR2Config(ACCOUNT, 'https://talibalilm')).toEqual(['R2_BUCKET']);
    expect(malformedR2Config(ACCOUNT, 'talibalilm/live')).toEqual(['R2_BUCKET']);
    expect(malformedR2Config(ACCOUNT, 'talibalilm:443')).toEqual(['R2_BUCKET']);
  });

  it('says nothing about an empty value — missing is a different report', () => {
    expect(malformedR2Config('', '')).toEqual([]);
  });
});
