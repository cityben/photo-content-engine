/**
 * Autopilot, the review queue and the to-do list: what gets drafted, that
 * drafts never become case studies or claim work, one-click approve-and-send,
 * and done / come back later.
 */

jest.mock('ai', () => ({
  gateway: { getAvailableModels: jest.fn(async () => ({ models: [] })) },
  generateText: jest.fn(),
  Output: { object: jest.fn((o) => o) },
}));

import { generateText } from 'ai';

import { cleanAutopilot, draftFromIdea, rankIdeas, relatedPhoto, runAutopilot } from '../src/lib/autopilot';
import { hasSubstance, isIdeaJob, needsApproval } from '../src/lib/content';
import { createIdea, getIdea } from '../src/lib/ideas';
import { createJob, deleteJob, generateForJob, getJob, sendBlog, setApproval } from '../src/lib/jobs';
import { actOn, gather, notifications, snoozeUntil, visible } from '../src/lib/notifications';
import { blockers, queueFrom, reviewAction } from '../src/lib/review';
import { slugify } from '../src/lib/website-api';

const user = { email: 'ben@example.co.uk' };
const photo = { url: '/api/media/0b6f1c1e-5a3c-4d1e-9a51-7f8e2c3d4b5a', width: 1600, height: 1100, alt: 'VRF condensers on a roof' };

const drafted = {
  blog: { title: 'VRF or split systems for offices?', excerpt: 'When each makes sense.', category: 'Air Conditioning', content: '## Start with the building\n\nThe floor plate decides.', primaryKeyword: 'vrf vs split system', imageAlt: '' },
  linkedin: { text: 'Most offices ask the wrong question.', hashtags: ['#HVAC'], firstComment: 'Read it: {{case_study_url}}' },
  googleBusiness: { text: 'New guide on choosing office air conditioning.' },
  seo: { keywords: [], rankingNotes: 'Estimate.', internalLinks: [] },
};

beforeEach(() => generateText.mockReset());

describe('choosing ideas', () => {
  const ideas = [
    { id: 'a', title: 'Case study idea', format: 'case-study', status: 'idea', score: 99 },
    { id: 'b', title: 'Low', format: 'article', status: 'idea', score: 20, createdAt: '2026-01-01' },
    { id: 'c', title: 'High', format: 'article', status: 'idea', score: 80, createdAt: '2026-01-02' },
    { id: 'd', title: 'Started', format: 'article', status: 'in_progress', jobId: 'x', score: 90 },
    { id: 'e', title: 'Overdue', format: 'linkedin', status: 'idea', score: 10, dueDate: '2026-10-01' },
    { id: 'f', title: 'Planned', format: 'article', status: 'planned', score: 30 },
  ];
  it('drafts overdue, then planned, then best score — never case studies or started ideas', () => {
    expect(rankIdeas(ideas, '2026-10-26').map((i) => i.id)).toEqual(['e', 'f', 'c', 'b']);
  });
  it('cleans settings', () => {
    expect(cleanAutopilot({ perRun: 40, formats: ['blog', 'caseStudy'] })).toMatchObject({ perRun: 6, formats: ['blog'], enabled: false, plan: true });
    expect(cleanAutopilot({ formats: [] }).formats).toEqual(['blog', 'linkedin', 'googleBusiness']);
  });
  it('borrows a photo only from a related finished job', () => {
    const jobs = [
      { id: '1', title: 'Office VRF replacement', images: [photo], details: { services: ['VRF systems'] } },
      { id: '2', kind: 'idea', title: 'VRF guide', images: [{ url: '/api/media/other' }] },
    ];
    expect(relatedPhoto({ title: 'VRF or split systems for offices?' }, jobs)).toMatchObject({ url: photo.url, from: { jobId: '1' } });
    expect(relatedPhoto({ title: 'Emergency lighting testing' }, jobs)).toBeNull();
  });
});

describe('drafting an idea', () => {
  it('makes an idea job with a blog post and posts, and tells the AI not to claim work', async () => {
    const { idea } = await createIdea({ title: 'VRF or split systems for offices?', keyword: 'vrf vs split system', format: 'article', angle: 'Help FMs choose.' }, user);
    generateText.mockResolvedValueOnce({ output: structuredClone(drafted), usage: {} });
    const { job, error } = await draftFromIdea(idea.id, { photos: false, user });
    expect(error).toBeNull();
    expect(isIdeaJob(job)).toBe(true);
    expect(job.target.keyword).toBe('vrf vs split system');
    expect(job.content.blog.title).toBe(drafted.blog.title);
    expect(job.content.caseStudy).toBeUndefined();
    expect(needsApproval(job).sort()).toEqual(['blog', 'googleBusiness', 'linkedin']);
    const prompt = generateText.mock.calls[0][0].messages[0].content.at(-1).text;
    expect(prompt).toMatch(/not a finished job/);
    expect(prompt).toMatch(/Write: blog, linkedin, googleBusiness, seo/);
    expect((await getIdea(idea.id)).status).toBe('in_progress');
    await expect(draftFromIdea(idea.id, { user })).rejects.toThrow(/already has/);
  });

  it('never writes a case study for an idea job', async () => {
    const job = await createJob({ title: 'Idea', writeUp: 'Angle', user, extra: { kind: 'idea' } });
    await expect(generateForJob(job.id, { sections: ['caseStudy'] })).rejects.toThrow(/case studies come from finished jobs/i);
  });

  it('keeps the draft when the AI fails, so it can be written by hand', async () => {
    const { idea } = await createIdea({ title: 'PPM schedules explained', format: 'article' }, user);
    generateText.mockRejectedValueOnce(new Error('Gateway down'));
    const { job, error } = await draftFromIdea(idea.id, { photos: false, user });
    expect(error).toBe('Gateway down');
    expect(await getJob(job.id)).toBeTruthy();
  });

  it('a run drafts the top ideas and records what it did', async () => {
    await createIdea({ title: 'EICR intervals for offices', keyword: 'eicr frequency commercial', format: 'article', score: 95 }, user);
    generateText.mockResolvedValue({ output: structuredClone(drafted), usage: {} });
    const run = await runAutopilot({ perRun: 1, plan: false, photos: false, user });
    expect(run.status).toBe('done');
    expect(run.drafts).toHaveLength(1);
    expect(run.drafts[0]).toMatchObject({ title: 'EICR intervals for offices', error: null });
  });
});

describe('blog post', () => {
  it('needs a title and article to approve, and a photo, summary and category to send', async () => {
    expect(hasSubstance('blog', { title: 'T', content: '' })).toBe(false);
    expect(hasSubstance('blog', { title: 'T', content: 'Body' })).toBe(true);
    const job = await createJob({ title: 'Idea', user, content: { blog: { ...drafted.blog, category: '' } }, extra: { kind: 'idea' } });
    await expect(sendBlog(job.id)).rejects.toThrow('Approve the blog post');
    await setApproval(job.id, 'blog', true, user);
    await expect(sendBlog(job.id)).rejects.toThrow(/category/);
    expect(blockers(await getJob(job.id), 'blog')).toEqual(['Add a header photo — the website needs one.', 'Add a category.']);
  });
  it('slugs titles for the website', () => {
    expect(slugify('VRF or split systems: what’s right for offices?')).toBe('vrf-or-split-systems-what-s-right-for-offices');
    expect(slugify('Heating & cooling')).toBe('heating-and-cooling');
  });
  it('only deletes photos no other job uses', async () => {
    const a = await createJob({ title: 'A', images: [photo], user });
    const b = await createJob({ title: 'B', images: [photo], user, extra: { kind: 'idea' } });
    expect(await deleteJob(b.id)).toBeTruthy();
    expect((await getJob(a.id)).images).toHaveLength(1);
  });
});

describe('review queue', () => {
  it('lists waiting sections first, skips what is already out', () => {
    const jobs = [
      { id: '1', title: 'One', content: { linkedin: { text: 'Hi', hashtags: [] }, googleBusiness: { text: 'GB' } }, approvals: { googleBusiness: { at: '2026-10-01' } }, posts: [], generatedAt: '2026-10-02' },
      { id: '2', title: 'Two', content: { linkedin: { text: 'Out', hashtags: [] } }, approvals: { linkedin: { at: 'x' } }, posts: [{ service: 'linkedin' }] },
    ];
    const q = queueFrom(jobs);
    expect(q.map((i) => `${i.key}:${i.state}`)).toEqual(['1:linkedin:approve', '1:googleBusiness:ready']);
    expect(q[0].next).toBe('schedule');
  });

  it('approve & schedule is one click, using the next free slot', async () => {
    const job = await createJob({ title: 'Post me', user, content: { linkedin: { text: 'Words.', hashtags: [], firstComment: '' } } });
    const { result } = await reviewAction({ jobId: job.id, section: 'linkedin', action: 'schedule', channelId: 'sandbox-linkedin' }, user);
    expect(result.kind).toBe('scheduled');
    const saved = await getJob(job.id);
    expect(saved.approvals.linkedin.by).toBe(user.email);
    expect(saved.posts).toHaveLength(1);
  });

  it('approves but refuses to send when something is missing', async () => {
    const job = await createJob({ title: 'No photo', user, content: { instagram: { caption: 'Cap', hashtags: [] } } });
    await expect(reviewAction({ jobId: job.id, section: 'instagram', action: 'schedule', channelId: 'sandbox-instagram' }, user)).rejects.toThrow(/Approved, but .*photo/);
    expect((await getJob(job.id)).approvals.instagram).toBeTruthy();
  });

  it('marks Google Business posts as posted', async () => {
    const job = await createJob({ title: 'GB', user, content: { googleBusiness: { text: 'Local news.' } } });
    const { job: done } = await reviewAction({ jobId: job.id, section: 'googleBusiness', action: 'posted' }, user);
    expect(done.googlePosted.by).toBe(user.email);
    expect(queueFrom([done])).toHaveLength(0);
  });
});

describe('to-do list', () => {
  const today = '2026-10-26';
  it('gathers from every source', () => {
    const items = gather({
      queue: [{ key: '1:linkedin', state: 'approve', idea: true, blockers: [] }],
      targets: { actions: [{ id: 'linkedin-today', severity: 'high', title: 'LinkedIn: 1 post short today', detail: 'd', kind: 'none' }, { id: 'pace', severity: 'low', title: 'pace' }] },
      leads: [{ id: 'l1', name: 'Acme FM', nextFollowUp: '2026-10-20', status: 'contacted' }],
      ideas: [{ id: 'i1', title: 'Late', dueDate: '2026-10-01', status: 'idea' }],
      checklist: [{ id: 'c1', title: 'Fix titles', status: 'open', impact: 'low' }, { id: 'c2', title: 'Done', status: 'done' }],
      today,
    });
    expect(items.map((i) => i.key)).toEqual(['review', 'targets-linkedin-today', 'lead-l1', 'idea-i1', 'focus-c1']);
    expect(items[0].detail).toMatch(/1 from autopilot/);
  });

  it('hides done items until their state changes, and snoozed ones until the time', () => {
    const now = '2026-10-26T10:00:00.000Z';
    const items = [
      { key: 'review', severity: 'high', fingerprint: 'a,b' },
      { key: 'lead-1', severity: 'medium', fingerprint: '2026-10-20' },
      { key: 'focus-9', severity: 'low', fingerprint: '', snoozedUntil: '2026-10-27T07:00:00.000Z' },
    ];
    expect(visible(items, [{ key: 'review', done: true, fingerprint: 'a,b' }, { key: 'lead-1', until: '2026-10-27T07:00:00.000Z' }], now)).toEqual([]);
    expect(visible([{ ...items[0], fingerprint: 'a,b,c' }], [{ key: 'review', done: true, fingerprint: 'a,b' }], now)).toHaveLength(1);
  });

  it('snoozes to sensible times', () => {
    const mon = new Date('2026-10-26T10:00:00Z');
    expect(snoozeUntil('tomorrow', mon)).toBe('2026-10-27T07:00:00.000Z');
    expect(snoozeUntil('week', mon)).toBe('2026-11-02T07:00:00.000Z');
    expect(snoozeUntil('hours', mon)).toBe('2026-10-26T13:00:00.000Z');
  });

  it('done and later work end to end', async () => {
    await createJob({ title: 'Waiting', user, content: { linkedin: { text: 'Approve me.', hashtags: [] } } });
    const before = await notifications();
    const review = before.items.find((i) => i.key === 'review');
    expect(review).toBeTruthy();
    await actOn({ key: 'review', fingerprint: review.fingerprint, action: 'snooze', later: 'tomorrow' }, user);
    expect((await notifications()).items.find((i) => i.key === 'review')).toBeUndefined();
    await actOn({ key: 'review', action: 'restore' }, user);
    expect((await notifications()).items.find((i) => i.key === 'review')).toBeTruthy();
  });
});
