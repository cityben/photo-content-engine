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
