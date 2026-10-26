/**
 * Tests for who is allowed to sign in
 */

import { isAllowedSignIn, tenantIdFromIssuer } from '../src/lib/access';

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
  describe('Google', () => {
    const google = (profile) => isAllowedSignIn({ provider: 'google', profile }, env);

    it('allows a verified Workspace account on the company domain', () => {
      expect(google({ email: 'ben@example.co.uk', email_verified: true, hd: 'example.co.uk' })).toBe(true);
    });

    it('rejects an unverified email', () => {
      expect(google({ email: 'ben@example.co.uk', email_verified: false, hd: 'example.co.uk' })).toBe(false);
    });

    it('rejects a company-domain email that is not in the Workspace', () => {
      expect(google({ email: 'ben@example.co.uk', email_verified: true })).toBe(false);
    });

    it('rejects other domains', () => {
      expect(google({ email: 'someone@gmail.com', email_verified: true })).toBe(false);
    });

    it('allows an explicitly allowlisted outside email', () => {
      const result = isAllowedSignIn(
        { provider: 'google', profile: { email: 'Agency@Gmail.com', email_verified: true } },
        { ...env, AUTH_ALLOWED_EMAILS: 'agency@gmail.com' }
      );
      expect(result).toBe(true);
    });
  });

  describe('Microsoft Entra ID', () => {
    const entra = (profile, e = env) => isAllowedSignIn({ provider: 'microsoft-entra-id', profile }, e);

    it('allows an account from the company tenant', () => {
      expect(entra({ email: 'ben@example.co.uk', tid: TENANT })).toBe(true);
    });

    it('rejects a company-domain email from another tenant', () => {
      expect(entra({ email: 'ben@example.co.uk', tid: '99999999-2222-3333-4444-555555555555' })).toBe(false);
    });

    it('rejects everyone when the issuer is not tenant-specific', () => {
      const common = { ...env, AUTH_MICROSOFT_ENTRA_ID_ISSUER: 'https://login.microsoftonline.com/common/v2.0' };
      expect(entra({ email: 'ben@example.co.uk', tid: TENANT }, common)).toBe(false);
    });
  });

  it('defaults to the example.co.uk domain', () => {
    const result = isAllowedSignIn(
      { provider: 'google', profile: { email: 'a@example.co.uk', email_verified: true, hd: 'example.co.uk' } },
      {}
    );
    expect(result).toBe(true);
  });

  it('denies unknown providers and missing emails', () => {
    expect(isAllowedSignIn({ provider: 'github', profile: { email: 'a@example.co.uk' } }, env)).toBe(false);
    expect(isAllowedSignIn({ provider: 'google', profile: {} }, env)).toBe(false);
  });
});
