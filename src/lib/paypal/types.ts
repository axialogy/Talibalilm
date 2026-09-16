/**
 * The PayPal shape that may cross into the browser.
 *
 * Kept out of `client.ts` because that module is `server-only`; a client
 * component importing even a type from it would be importing the secret's
 * module. Only these three fields are ever public.
 */
export interface PayPalPublicConfig {
  clientId: string;
  currency: string;
  environment: 'sandbox' | 'live';
}
