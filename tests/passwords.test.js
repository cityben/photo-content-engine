/**
 * Tests for email + password accounts
 */

import {
  checkCredentials,
  clearFailures,
  hashPassword,
  isLockedOut,
  parseUsers,
  recordFailure,
  verifyPassword,
} from '../src/lib/passwords';

const PASSWORD = 'correct horse battery staple';

describe('hashPassword / verifyPassword', () => {
  let hash;
  beforeAll(async () => {
    hash = await hashPassword(PASSWORD);
  });

  it('produces a salted scrypt hash without $ signs', async () => {
    expect(hash).toMatch(/^scrypt\.15\.8\.1\.[\w-]+\.[\w-]+$/);
    expect(await hashPassword(PASSWORD)).not.toBe(hash);
  });

  it('accepts the right password and rejects others', async () => {
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword('wrong password here', hash)).toBe(false);
  });

  it('rejects malformed or missing hashes', async () => {
    expect(await verifyPassword(PASSWORD, undefined)).toBe(false);
    expect(await verifyPassword(PASSWORD, 'plaintext')).toBe(false);
  });

  it('refuses short passwords', async () => {
    await expect(hashPassword('short')).rejects.toThrow(/at least 12/);
  });
});

describe('parseUsers / checkCredentials', () => {
  let users;
  beforeAll(async () => {
    const hash = await hashPassword(PASSWORD);
    users = parseUsers(`Ben@Example.co.uk|${hash}, broken-entry, other@x.com|notahash`);
  });

  it('parses valid entries and skips malformed ones', () => {
    expect([...users.keys()]).toEqual(['ben@example.co.uk']);
  });

  it('matches email case-insensitively', async () => {
    expect(await checkCredentials(' BEN@example.co.uk ', PASSWORD, users)).toBe('ben@example.co.uk');
  });

  it('rejects wrong passwords and unknown emails', async () => {
    expect(await checkCredentials('ben@example.co.uk', 'nope nope nope', users)).toBeNull();
    expect(await checkCredentials('nobody@example.co.uk', PASSWORD, users)).toBeNull();
  });
});

describe('lockout', () => {
  const keys = ['email:test@x.com', 'ip:1.2.3.4'];
  afterEach(() => clearFailures(keys));

  it('locks after 5 failures and unlocks after 15 minutes', () => {
    const t = 1_000_000;
    for (let i = 0; i < 4; i++) recordFailure(keys, t);
    expect(isLockedOut(keys, t)).toBe(false);
    recordFailure(keys, t);
    expect(isLockedOut(keys, t)).toBe(true);
    expect(isLockedOut(['email:other@x.com', 'ip:1.2.3.4'], t)).toBe(true);
    expect(isLockedOut(keys, t + 15 * 60 * 1000)).toBe(false);
  });
});
