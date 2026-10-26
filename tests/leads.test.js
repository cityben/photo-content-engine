/**
 * Leads: fit score, de-duplication, and the outreach approval gate
 */

import { addDraft, addLeads, approveDraft, dueFollowUps, editDraft, fitScore, getLead, markSent, relevantJobs, updateLead } from '../src/lib/leads';

const user = { email: 'ben@example.co.uk' };
const row = (over = {}) => ({ cid: '111', name: 'Acme Property Management', category: 'Property management company', categoryIds: ['property_management_company'], domain: 'acme-pm.co.uk', website: 'https://acme-pm.co.uk', reviews: 120, rating: 4.5, fit: 80, ...over });

describe('fitScore', () => {
  it('favours buyers, size and a website', () => {
    const pm = fitScore({ categoryIds: ['property_management_company'], reviews: 300, website: 'x' });
    const cafe = fitScore({ categoryIds: ['restaurant'], reviews: 300, website: 'x' });
    const tiny = fitScore({ categoryIds: ['property_management_company'], reviews: 0 });
    expect(pm).toBeGreaterThan(cafe);
    expect(pm).toBeGreaterThan(tiny);
    expect(pm).toBeLessThanOrEqual(100);
  });
});

describe('leads pipeline', () => {
  it('skips businesses already in the pipeline by Google id or website', async () => {
    const first = await addLeads([row()], user);
    expect(first.added).toBe(1);
    const again = await addLeads([row({ cid: '222' }), row({ cid: '111', domain: 'other.co.uk' }), row({ cid: '333', domain: 'new.co.uk', name: 'New Co' })], user);
    expect(again).toMatchObject({ added: 1, skipped: 2 });
  });

  it('logs stage changes and notes', async () => {
    const { leads: [lead] } = await addLeads([row({ cid: '444', domain: 'b.co.uk', name: 'B Ltd' })], user);
    const updated = await updateLead(lead.id, { status: 'replied', note: 'Called the FM' }, user);
    expect(updated.activity.map((a) => a.type)).toEqual(['created', 'status', 'note']);
    expect(updated.activity[1].text).toBe('New → Replied');
  });

  it('will not mark a draft sent until approved, and an edit clears approval', async () => {
    const { leads: [lead] } = await addLeads([row({ cid: '555', domain: 'c.co.uk', name: 'C Ltd' })], user);
    let l = await addDraft(lead.id, { subject: 'Your Canary Wharf offices', body: 'Hello.' }, user);
    const id = l.drafts[0].id;
    await expect(markSent(lead.id, id, user)).rejects.toThrow('Approve this draft');
    await approveDraft(lead.id, id, true, user);
    l = await editDraft(lead.id, id, { body: 'Hello again.' }, user);
    expect(l.drafts[0].approved).toBeNull();
    await expect(markSent(lead.id, id, user)).rejects.toThrow('Approve this draft');
    await approveDraft(lead.id, id, true, user);
    l = await markSent(lead.id, id, user, new Date('2026-10-23T10:00:00Z')); // a Friday
    expect(l).toMatchObject({ status: 'contacted', nextFollowUp: '2026-10-30' });
    expect(l.drafts[0].sentAt).toBe('2026-10-23T10:00:00.000Z');
    await expect(editDraft(lead.id, id, { body: 'x' }, user)).rejects.toThrow('already sent');
    expect(dueFollowUps([await getLead(lead.id)], '2026-10-30')).toHaveLength(1);
    expect(dueFollowUps([await getLead(lead.id)], '2026-10-29')).toHaveLength(0);
  });

  it('picks our real jobs to cite, sector matches first', () => {
    const jobs = [
      { title: 'Untitled job' },
      { title: 'School heat pumps', details: { sector: 'Education' } },
      { title: 'Office VRF', details: { sector: 'Commercial Office' }, website: { projectId: 'p1' } },
    ];
    const picked = relevantJobs({ category: 'Commercial real estate agency', categoryIds: ['commercial_real_estate_agency'] }, jobs);
    expect(picked.map((j) => j.title)).toEqual(['Office VRF', 'School heat pumps']);
  });
});
