/**
 * Word case study → job fields, without AI
 */

import { mapCaseStudy, matchOption } from '../src/lib/docx-map';

const h = (text) => ({ type: 'heading', text });
const p = (text) => ({ type: 'p', text });
const li = (text) => ({ type: 'li', text });

describe('mapCaseStudy', () => {
  const doc = [
    h('VRF Replacement — 30 South Colonnade'),
    p('Client: Canary Wharf Group'),
    p('Location: Canary Wharf, London'),
    p('Sector: Commercial Offices'),
    p('Division: Acme Air Conditioning'),
    p('Completed: March 2026'),
    p('Duration: 6 weeks'),
    p('Services: VRF / VRV Systems, Commissioning'),
    p('We replaced four failing split systems with a Mitsubishi VRF system across three occupied floors. The tenant stayed in throughout.'),
    h('Scope of Works'),
    li('Strip out four split systems'),
    li('Install VRF outdoor units'),
    h('Key Challenges'),
    p('Occupied building: works phased floor by floor.'),
    h('The Outcome'),
    p('Reliable zoned cooling on every floor.'),
    h('Client Feedback'),
    p('“Smooth job, no disruption.”'),
    p('— Facilities Manager'),
    h('Team'),
    p('Two engineers and a supervisor.'),
  ];
  const r = mapCaseStudy(doc);

  it('takes the title from the first heading', () => {
    expect(r.title).toBe('VRF Replacement — 30 South Colonnade');
  });

  it('fills website sections from matching headings as markdown', () => {
    expect(r.caseStudy.scopeOfWorks).toBe('- Strip out four split systems\n- Install VRF outdoor units');
    expect(r.caseStudy.keyChallenges).toBe('Occupied building: works phased floor by floor.');
    expect(r.caseStudy.projectOutcome).toBe('Reliable zoned cooling on every floor.');
  });

  it('reads labelled lines and matches the website options exactly', () => {
    expect(r.caseStudy).toMatchObject({
      client: 'Canary Wharf Group',
      area: 'Canary Wharf',
      county: 'London',
      sector: 'Commercial Office',
      company: 'Acme Air Conditioning',
      durationWeeks: 6,
    });
    expect(r.caseStudy.services).toContain('VRF / VRV Systems');
    expect(r.details.completedOn).toBe('2026-03');
  });

  it('uses the opening paragraph as the summary and keeps the testimonial', () => {
    expect(r.caseStudy.description).toMatch(/^We replaced four failing split systems/);
    expect(r.caseStudy.testimonialQuote).toBe('Smooth job, no disruption.');
    expect(r.caseStudy.testimonialAuthor).toBe('Facilities Manager');
  });

  it('keeps unrecognised sections instead of dropping them', () => {
    expect(r.unmatchedHeadings).toEqual(['Team']);
    expect(r.caseStudy.writeUp).toBe('## Team\n\nTwo engineers and a supervisor.');
    expect(r.writeUp).toContain('Two engineers and a supervisor.');
  });

  it('flags values that are not website options', () => {
    const odd = mapCaseStudy([h('Job'), p('Sector: Space Station')]);
    expect(odd.caseStudy.sector).toBe('');
    expect(odd.unmatchedValues).toEqual(['Sector "Space Station"']);
  });
});

describe('matchOption', () => {
  it('matches plurals and ampersands', () => {
    expect(matchOption('Commercial Offices', ['Commercial Office', 'Retail'])).toBe('Commercial Office');
    expect(matchOption('Laboratory and Research', ['Laboratory & Research'])).toBe('Laboratory & Research');
    expect(matchOption('Nonsense', ['Retail'])).toBeNull();
  });
});

describe('known values', () => {
  const doc = [
    { type: 'heading', text: 'Office cooling' },
    { type: 'p', text: 'Client: Someone Else Ltd' },
    { type: 'p', text: 'Sector: Retail' },
    { type: 'heading', text: 'Scope of works' },
    { type: 'li', text: 'New VRF' },
  ];

  it('win over the document, which fills the gaps', () => {
    const r = mapCaseStudy(doc, { title: 'VRF swap, Canary Wharf', client: 'Canary Wharf Group', sector: 'Commercial Office', area: 'Canary Wharf', county: 'London', services: ['VRF / VRV Systems'], completedOn: '2026-03', durationWeeks: 6 });
    expect(r.caseStudy).toMatchObject({
      title: 'VRF swap, Canary Wharf',
      client: 'Canary Wharf Group',
      sector: 'Commercial Office',
      area: 'Canary Wharf',
      county: 'London',
      services: ['VRF / VRV Systems'],
      durationWeeks: 6,
      scopeOfWorks: '- New VRF',
    });
    expect(r.details.completedOn).toBe('2026-03');
    expect(r.overridden.sort()).toEqual(['client', 'sector', 'title']);
  });

  it('work with no document at all', () => {
    const r = mapCaseStudy([], { title: 'Plant room upgrade', sector: 'Healthcare', client: 'NHS Trust' });
    expect(r.caseStudy).toMatchObject({ title: 'Plant room upgrade', sector: 'Healthcare', client: 'NHS Trust' });
  });
});
