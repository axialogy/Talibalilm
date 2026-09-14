import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A hostname that does not resolve cannot be fixed by retrying.
 *
 * The school's mail was dead for days with `getaddrinfo EBUSY
 * mail.talibalim.com` while the panel, the password and the port were all
 * correct — the name simply had no DNS record. Two things had to change, and
 * both are pinned here:
 *
 * 1. `SMTP_SERVERNAME`, so the connection can go to an IP address while the
 *    certificate is still verified against the name it was issued for. Without
 *    it the only way to use an address is to switch certificate checking off,
 *    which trades a broken mail server for an impersonable one.
 * 2. A sentence a non-engineer can act on, with the raw error kept after it.
 *    `EBUSY` does not mean "busy"; it is what the platform's resolver returns
 *    when it cannot answer at all, and reading it as a transient fault is how
 *    an afternoon disappears.
 */

const createTransport = vi.fn(() => ({
  verify: async () => true,
  close: () => {},
  sendMail: async () => ({}),
}));

vi.mock('nodemailer', () => ({ default: { createTransport } }));

describe('SMTP_SERVERNAME', () => {
  beforeEach(() => {
    vi.resetModules();
    createTransport.mockClear();
    process.env.SMTP_USER = 'contact@example.org';
    process.env.SMTP_PASSWORD = 'secret';
    process.env.SMTP_PORT = '465';
    delete process.env.SMTP_SERVERNAME;
  });

  const optionsAfterProbe = async () => {
    const { smtpProbe } = await import('@/lib/email/send');
    await smtpProbe(50);
    const [options] = createTransport.mock.calls[0] as unknown as [unknown];
    return options as {
      host: string;
      secure: boolean;
      tls?: { servername?: string; rejectUnauthorized?: boolean };
    };
  };

  it('defaults the certificate name to the host, changing nothing for a normal install', async () => {
    process.env.SMTP_HOST = 'mail.example.org';
    const options = await optionsAfterProbe();
    expect(options.host).toBe('mail.example.org');
    expect(options.tls?.servername).toBe('mail.example.org');
  });

  it('lets the connection go to an IP while the certificate keeps its name', async () => {
    process.env.SMTP_HOST = '91.121.51.179';
    process.env.SMTP_SERVERNAME = 'mail.example.org';
    const options = await optionsAfterProbe();
    expect(options.host).toBe('91.121.51.179');
    expect(options.tls?.servername).toBe('mail.example.org');
  });

  it('never switches certificate verification off to make mail work', async () => {
    process.env.SMTP_HOST = '91.121.51.179';
    process.env.SMTP_SERVERNAME = 'mail.example.org';
    const options = await optionsAfterProbe();
    // Absent means Node's default, which is to verify. An explicit `false` here
    // would be the shortcut this test exists to forbid.
    expect(options.tls?.rejectUnauthorized).not.toBe(false);
  });

  it('still derives implicit TLS from the port', async () => {
    process.env.SMTP_HOST = 'mail.example.org';
    process.env.SMTP_PORT = '587';
    const options = await optionsAfterProbe();
    expect(options.secure).toBe(false);
  });
});

describe('explainSmtp', () => {
  const explain = async (error: unknown) => {
    const { explainSmtp } = await import('@/lib/email/send');
    return explainSmtp(error, 'mail.example.org');
  };

  const withCode = (code: string, message: string) =>
    Object.assign(new Error(message), { code });

  it('reads EBUSY as a missing DNS record, not a busy server', async () => {
    const said = await explain(withCode('EBUSY', 'getaddrinfo EBUSY mail.example.org'));
    expect(said).toContain('n’existe pas dans le DNS');
    // The evidence survives our reading of it.
    expect(said).toContain('getaddrinfo EBUSY mail.example.org');
  });

  it('reads ENOTFOUND and EAI_AGAIN the same way', async () => {
    for (const code of ['ENOTFOUND', 'EAI_AGAIN']) {
      expect(await explain(withCode(code, `getaddrinfo ${code} mail.example.org`))).toContain(
        'n’existe pas dans le DNS',
      );
    }
  });

  it('separates a closed port from a missing name', async () => {
    const said = await explain(withCode('ECONNREFUSED', 'connect ECONNREFUSED 1.2.3.4:465'));
    expect(said).toContain('refusé la connexion');
    expect(said).not.toContain('DNS');
  });

  it('separates a silent server from both', async () => {
    expect(await explain(withCode('ETIMEDOUT', 'Connection timeout'))).toContain('pas répondu');
  });

  it('names the fix when the certificate does not match the host', async () => {
    const said = await explain(
      withCode('ERR_TLS_CERT_ALTNAME_INVALID', "Hostname/IP does not match certificate's altnames"),
    );
    expect(said).toContain('SMTP_SERVERNAME');
  });

  it('recognises a rejected password', async () => {
    expect(await explain(new Error('535 Incorrect authentication data'))).toContain('identifiant');
  });

  it('passes an unrecognised failure through untouched rather than guessing', async () => {
    expect(await explain(new Error('something nobody has seen before'))).toBe(
      'something nobody has seen before',
    );
  });
});
