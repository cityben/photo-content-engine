/**
 * Approval gate: nothing goes out unapproved, and approval covers exact content
 */

jest.mock('ai', () => ({
  gateway: { getAvailableModels: jest.fn(async () => ({ models: [] })) },
  generateText: jest.fn(),
  Output: { object: jest.fn((o) => o) },
}));

import { generateText } from 'ai';

import { createJob, generateForJob, getJob, saveJobEdits, scheduleForJob, sendCaseStudy, setApproval } from '../src/lib/jobs';

const user = { email: 'ben@example.co.uk' };
const content = {
  linkedin: { text: 'Approved words.', hashtags: ['#VRF'], firstComment: '' },
  instagram: { caption: 'Caption', hashtags: [], firstComment: '', altText: '' },
  caseStudy: { title: 'VRF job', description: 'Lede.' },
};

async function newJob() {
  return createJob({ title: 'Job', writeUp: 'Replaced four splits with VRF.', content: structuredClone(content), user });
}

describe('approval gate', () => {
  it('refuses to schedule or send anything unapproved', async () => {
    const job = await newJob();
    await expect(scheduleForJob(job.id, { channelId: 'sandbox-linkedin' })).rejects.toThrow('Approve the LinkedIn post');
    await expect(sendCaseStudy(job.id)).rejects.toThrow('Approve the case study');
  });

  it('schedules the saved approved text, not text from the request', async () => {
    const job = await newJob();
    await setApproval(job.id, 'linkedin', true, user);
    const post = await scheduleForJob(job.id, { channelId: 'sandbox-linkedin', text: 'Sneaky different text' });
    expect(post.text).toBe('Approved words.\n\n#VRF');
    expect((await getJob(job.id)).approvals.linkedin.by).toBe(user.email);
  });

  it('clears approval only for sections that changed', async () => {
    const job = await newJob();
    await setApproval(job.id, 'linkedin', true, user);
    await setApproval(job.id, 'instagram', true, user);
    const edited = await saveJobEdits(job.id, { content: { linkedin: { ...content.linkedin, text: 'Changed.' }, instagram: content.instagram } });
    expect(edited.approvals.linkedin).toBeNull();
    expect(edited.approvals.instagram).toBeTruthy();
  });

  it('will not approve an empty section', async () => {
    const job = await createJob({ title: 'Empty', user });
    await expect(setApproval(job.id, 'linkedin', true, user)).rejects.toThrow(/empty/);
  });

  it('clears approval when AI rewrites a section and keeps Word fields when asked', async () => {
    const job = await newJob();
    await setApproval(job.id, 'caseStudy', true, user);
    generateText.mockResolvedValueOnce({
      output: { caseStudy: { title: 'AI title', description: 'AI lede', seoTitle: 'AI SEO title', services: [] } },
      usage: {},
    });
    const updated = await generateForJob(job.id, { sections: ['caseStudy'], preserve: ['caseStudy'] });
    expect(updated.content.caseStudy).toMatchObject({ title: 'VRF job', description: 'Lede.', seoTitle: 'AI SEO title' });
    expect(updated.approvals.caseStudy).toBeNull();
  });
});

describe('calendar: ready tray, autofill, schedule', () => {
  const { readyToSchedule } = require('../src/lib/jobs');
  const { planAutofill, applyAutofill } = require('../src/lib/autofill');
  const { setSchedule } = require('../src/lib/schedule');

  it('lists approved, unscheduled posts and autofills them into publishing slots', async () => {
    await setSchedule({ linkedin: { days: [2], times: ['09:00'] }, instagram: { days: [4], times: ['13:00'] } }, user);
    const job = await createJob({ title: 'Tray job', writeUp: 'w', content: structuredClone(content), user });
    await setApproval(job.id, 'linkedin', true, user);
    await setApproval(job.id, 'instagram', true, user);
    // Instagram needs a photo in the sandbox
    await saveJobEdits(job.id, { images: [{ url: '/api/media/00000001-0000-0000-0000-000000000000', public: false }] });

    const ready = (await readyToSchedule()).filter((i) => i.jobId === job.id);
    expect(ready.map((i) => i.service).sort()).toEqual(['instagram', 'linkedin']);

    const plan = (await planAutofill()).filter((i) => i.jobId === job.id);
    const li = plan.find((p) => p.service === 'linkedin');
    const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(li.dueAt));
    expect(day).toMatch(/^Tue,? 09:00$/);

    const results = (await applyAutofill()).filter((r) => r.jobId === job.id);
    expect(results.every((r) => r.ok)).toBe(true);
    expect((await readyToSchedule()).filter((i) => i.jobId === job.id)).toEqual([]);
  });
});
