/**
 * Company profile: stored in the database, not the code
 */

import { cleanProfile, companyLine, getOptions, getProfile, saveProfile } from '../src/lib/profile';
import { TEST_PROFILE } from './fixtures/profile';

describe('company profile', () => {
  it('starts empty, so the code carries no company details', async () => {
    expect(await getProfile()).toMatchObject({ name: '', companies: [], serviceGroups: [] });
    expect(companyLine(await getProfile())).toBe('You write for the company.');
  });

  it('saves a cleaned profile and serves its lists', async () => {
    await saveProfile({ ...TEST_PROFILE, domain: 'https://www.example.co.uk/about', companies: [...TEST_PROFILE.companies, ' ', 'Acme Mechanical'], servicePages: [{ label: 'Bad', href: 'javascript:alert(1)' }, ...TEST_PROFILE.servicePages] });
    const p = await getProfile();
    expect(p.domain).toBe('example.co.uk');
    expect(p.companies).toEqual(TEST_PROFILE.companies);
    expect(p.servicePages).toEqual(TEST_PROFILE.servicePages);
    expect((await getOptions()).serviceGroups).toHaveLength(3);
    expect(companyLine(p)).toBe('You write for Acme Building Services, trading since 2015, working across the South East. Divisions: Air Conditioning, Mechanical, Electrical. Building services contractor.');
  });

  it('drops malformed lists', () => {
    expect(cleanProfile({ companies: 'x', serviceGroups: [{ division: 'A', services: [] }] })).toMatchObject({ companies: [], serviceGroups: [] });
  });
});
