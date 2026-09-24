import { describe, expect, it } from 'vitest';
import { classifyAuthError } from '../../src/lib/auth/errors';

/**
 * Supabase returns prose, and the exact wording changes between releases. A
 * mapping that quietly stops matching turns every specific, actionable message
 * into "try again in a moment" — which is what sent this project chasing an
 * environment variable when the real answer was in the text all along.
 */
describe('classifying Supabase auth errors', () => {
  it.each([
    ['Invalid login credentials', 'invalidCredentials'],
    ['Email not confirmed', 'emailNotConfirmed'],
    ['User already registered', 'emailTaken'],
    ['A user with this email address has already been registered', 'emailTaken'],
    ['Email rate limit exceeded', 'rateLimited'],
    ['For security purposes, you can only request this after 51 seconds', 'rateLimited'],
    ['Token has expired or is invalid', 'expiredLink'],
    ['Password should be at least 6 characters', 'weakPassword'],
    ['Signups not allowed for this instance', 'signupsDisabled'],
    ['Database error saving new user', 'databaseError'],
    ['Database error granting user', 'databaseError'],
    ['captcha protection: request disallowed (captcha_failed)', 'captchaFailed'],
    ['invalid captcha token', 'captchaFailed'],
  ])('reads %j as %s', (raw, expected) => {
    expect(classifyAuthError(raw)).toBe(expected);
  });

  it('falls back rather than throwing on anything it has never seen', () => {
    expect(classifyAuthError('something nobody has written yet')).toBe('unexpected');
    expect(classifyAuthError('')).toBe('unexpected');
  });

  it('does not mistake a database error for a credentials problem', () => {
    // These two want completely different responses — one is the student's
    // typo, the other is the migrations not being applied.
    expect(classifyAuthError('Database error saving new user')).not.toBe('invalidCredentials');
  });

  it('matches whatever case the message arrives in', () => {
    expect(classifyAuthError('INVALID LOGIN CREDENTIALS')).toBe('invalidCredentials');
    expect(classifyAuthError('database error saving new user')).toBe('databaseError');
  });
});

describe('the failures that stop a school taking registrations', () => {
  it('recognises Supabase failing to send the confirmation email', () => {
    // The free plan's built-in sender allows a handful of messages an hour.
    // Past that every sign-up fails here, and the raw message says nothing
    // about email — so without this it reads as a generic outage and the real
    // cause (no custom SMTP configured) is never looked at.
    expect(classifyAuthError('Error sending confirmation email')).toBe('emailSendFailed');
    expect(classifyAuthError('Error sending recovery email')).toBe('emailSendFailed');
    expect(classifyAuthError('Error sending magic link email')).toBe('emailSendFailed');
    expect(classifyAuthError('failed to send email: smtp: dial tcp: timeout')).toBe(
      'emailSendFailed',
    );
  });

  it('recognises an address the provider refuses', () => {
    expect(classifyAuthError('Unable to validate email address: invalid format')).toBe(
      'emailInvalid',
    );
    expect(classifyAuthError('invalid_email')).toBe('emailInvalid');
  });

  it('still tells a send failure apart from a rate limit', () => {
    // Both mean "wait", but only one is fixed by configuring SMTP, and the
    // person reading the logs needs to know which they are looking at.
    expect(classifyAuthError('email rate limit exceeded')).toBe('rateLimited');
    expect(
      classifyAuthError('For security purposes, you can only request this after 51 seconds'),
    ).toBe('rateLimited');
  });
  it('recognises a service that simply did not answer', () => {
    // What supabase-js reports for a network failure. Neither string says
    // anything about auth, e-mail or the person registering, which is why they
    // all used to land in the catch-all and tell a REGISTERING student that we
    // "cannot sign you in".
    expect(classifyAuthError('fetch failed')).toBe('serviceUnavailable');
    expect(classifyAuthError('TypeError: Failed to fetch')).toBe('serviceUnavailable');
    expect(classifyAuthError('connect ETIMEDOUT 10.0.0.1:443')).toBe('serviceUnavailable');
    expect(classifyAuthError('read ECONNRESET')).toBe('serviceUnavailable');
    expect(classifyAuthError('504 Gateway Timeout')).toBe('serviceUnavailable');
    expect(classifyAuthError('upstream context deadline exceeded')).toBe('serviceUnavailable');
  });

  it('lets every specific cause beat the new catch-all', () => {
    // The whole risk of a broad pattern is that it swallows the narrow ones
    // above it. Each of these contains a word the serviceUnavailable pattern
    // also matches, and each must still classify as itself.
    expect(classifyAuthError('failed to send email: smtp: dial tcp: timeout')).toBe(
      'emailSendFailed',
    );
    expect(classifyAuthError('Error sending confirmation email: i/o timeout')).toBe(
      'emailSendFailed',
    );
    expect(
      classifyAuthError('For security purposes, you can only request this after 51 seconds'),
    ).toBe('rateLimited');
    expect(classifyAuthError('Database error saving new user: timeout')).toBe('databaseError');
  });

  it('keeps a genuinely unknown message in the catch-all', () => {
    // The point of serviceUnavailable is to be narrower than "anything we do
    // not recognise". Something we have never seen must still be reported as
    // unmapped so a pattern gets added, rather than being quietly explained
    // away as an outage.
    expect(classifyAuthError('Some entirely new GoTrue message')).toBe('unexpected');
  });
});
