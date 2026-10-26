/**
 * A made-up company profile for tests (Settings → Company profile shape).
 */

export const TEST_PROFILE = {
  name: 'Acme Building Services',
  about: 'Building services contractor.',
  regions: 'the South East',
  founded: '2015',
  domain: 'example.co.uk',
  companies: ['Acme Air Conditioning', 'Acme Mechanical', 'Acme Electrical', 'Acme Facilities'],
  sectors: ['Commercial Office', 'Education', 'Healthcare', 'Retail', 'Hospitality'],
  projectTypes: ['New', 'Refurbishment', 'Replacement', 'Cat A Fit-out', 'Cat B Fit-out'],
  serviceGroups: [
    { division: 'Air Conditioning', company: 'Acme Air Conditioning', services: ['Commercial Air Conditioning', 'VRF / VRV Systems', 'Commissioning & Compliance'] },
    { division: 'Mechanical', company: 'Acme Mechanical', services: ['Heating (LTHW)', 'Commissioning'] },
    { division: 'Electrical', company: 'Acme Electrical', services: ['EICR Testing', 'Lighting'] },
  ],
  servicePages: [{ label: 'VRF / VRV Systems', href: '/services/air-conditioning/vrf-vrv-systems' }],
};

export const TEST_OPTIONS = {
  companies: TEST_PROFILE.companies,
  sectors: TEST_PROFILE.sectors,
  projectTypes: TEST_PROFILE.projectTypes,
  serviceGroups: TEST_PROFILE.serviceGroups,
  servicePages: TEST_PROFILE.servicePages,
};
