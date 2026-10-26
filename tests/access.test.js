/**
 * Tests for who is allowed to sign in
 */

import { isAllowedSignIn, tenantIdFromIssuer } from '../src/lib/access';
import { safeCallback } from '../src/lib/redirects';

const TENANT = '11111111-2222-3333-4444-555555555555';
const env = {
  AUTH_ALLOWED_DOMAINS: 'example.co.uk',
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: `https://login.microsoftonline.com/${TENANT}/v2.0`,
};

describe('tenantIdFromIssuer', () => {
  it('reads the tenant ID from a tenant-specific issuer', () => {
    expect(tenantIdFromIssuer(env.AUTH_MICROSOFT_ENTRA_ID_ISSUER)).toBe(TENANT);
  });

  it('returns null for the multi-tenant "common" issuer', () => {
    expect(tenantIdFromIssuer('https://login.microsoftonline.com/common/v2.0')).toBeNull();
  });
});

describe('isAllowedSignIn', () => {
  it('allows password sign-ins (already checked by authorize)', () => {
    expect(isAllowedSignIn({ provider: 'credentials', email: 'a@b.com' }, env)).toBe(true);
  });

  describe('Microsoft Entra ID', () => {
    const entra = (profile, e = env) => isAllowedSignIn({ provider: 'microsoft-entra-id', profile }, e);

    it('allows an account from the company tenant', () => {
      expect(entra({ email: 'ben@example.co.uk', tid: TENANT })).toBe(true);
    });

    it('rejects a company-domain email from another tenant', () => {
      expect(entra({ email: 'ben@example.co.uk', tid: '99999999-2222-3333-4444-555555555555' })).toBe(false);
    });

    it('rejects other domains even within the tenant', () => {
      expect(entra({ email: 'guest@gmail.com', tid: TENANT })).toBe(false);
    });

    it('allows an allowlisted guest within the tenant', () => {
      expect(entra({ email: 'guest@gmail.com', tid: TENANT }, { ...env, AUTH_ALLOWED_EMAILS: 'guest@gmail.com' })).toBe(true);
    });

    it('rejects everyone when the issuer is not tenant-specific', () => {
      const common = { ...env, AUTH_MICROSOFT_ENTRA_ID_ISSUER: 'https://login.microsoftonline.com/common/v2.0' };
      expect(entra({ email: 'ben@example.co.uk', tid: TENANT }, common)).toBe(false);
    });

    it('has no default domain: Microsoft sign-in stays closed until one is set', () => {
      const e = { AUTH_MICROSOFT_ENTRA_ID_ISSUER: env.AUTH_MICROSOFT_ENTRA_ID_ISSUER };
      expect(entra({ email: 'a@example.co.uk', tid: TENANT }, e)).toBe(false);
    });
  });

  it('denies unknown providers and missing emails', () => {
    expect(isAllowedSignIn({ provider: 'github', profile: { email: 'a@example.co.uk' } }, env)).toBe(false);
    expect(isAllowedSignIn({ provider: 'microsoft-entra-id', profile: { tid: TENANT } }, env)).toBe(false);
  });
});

describe('safeCallback', () => {
  it('keeps same-site paths', () => {
    expect(safeCallback('/foo?x=1')).toBe('/foo?x=1');
  });

  it('rejects other sites', () => {
    expect(safeCallback('//evil.com')).toBe('/');
    expect(safeCallback('https://evil.com')).toBe('/');
    expect(safeCallback(null)).toBe('/');
  });
});
