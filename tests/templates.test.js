/**
 * Channel templates: guidance the AI reads, and top/bottom text added word
 * for word to every new post.
 */

jest.mock('ai', () => ({
  gateway: { getAvailableModels: jest.fn(async () => ({ models: [] })) },
  generateText: jest.fn(),
  Output: { object: jest.fn((o) => o) },
}));

import { generateText } from 'ai';

import { createJob, generateForJob } from '../src/lib/jobs';
import { saveTemplates } from '../src/lib/template-store';
import { applyTemplate, applyTemplates, cleanTemplates, fillVariables, templatePrompt } from '../src/lib/templates';

const job = { title: 'VRF swap', details: { location: 'Rochester', client: '' } };
const t = { guide: 'Mention F-Gas certification.', top: 'New from {{location}}:', bottom: 'Need a survey? Call 01234 567890.' };

describe('applying a template', () => {
  it('wraps the post with top and bottom text', () => {
    expect(applyTemplate('linkedin', { text: 'Body.' }, t, job).text).toBe('New from Rochester:\n\nBody.\n\nNeed a survey? Call 01234 567890.');
  });
  it('is safe to run twice', () => {
    const once = applyTemplate('linkedin', { text: 'Body.' }, t, job);
    expect(applyTemplate('linkedin', once, t, job)).toEqual(once);
  });
  it('uses the right field for each channel and leaves case studies alone', () => {
    const out = applyTemplates({ instagram: { caption: 'Cap' }, blog: { content: 'Article' }, caseStudy: { title: 'X' } }, { instagram: { bottom: 'Bye' }, blog: { top: 'Hi' }, caseStudy: { top: 'never' } }, job);
    expect(out.instagram.caption).toBe('Cap\n\nBye');
    expect(out.blog.content).toBe('Hi\n\nArticle');
    expect(out.caseStudy).toEqual({ title: 'X' });
  });
  it('fills blanks for writing by hand', () => {
    expect(applyTemplate('googleBusiness', { text: '' }, t, job).text).toBe('New from Rochester:\n\nNeed a survey? Call 01234 567890.');
  });
  it('fills job variables and drops empty ones cleanly', () => {
    expect(fillVariables('For {{client}} at {{title}}', job)).toBe('For  at VRF swap');
  });
  it('drops top/bottom for case studies when saving', () => {
    expect(cleanTemplates({ caseStudy: { guide: 'g', top: 'x' } }).caseStudy).toEqual({ guide: 'g', top: '', bottom: '' });
  });
  it('tells the AI the guidance and what is added for it', () => {
    const p = templatePrompt({ linkedin: t }, ['linkedin', 'instagram']);
    expect(p).toMatch(/linkedin — house template.*F-Gas/);
    expect(p).toMatch(/added automatically, at the top: "New from \{\{location\}\}:" and at the bottom/);
    expect(templatePrompt({}, ['linkedin'])).toBe('');
  });
});

it('adds the saved template after the AI writes', async () => {
  await saveTemplates({ linkedin: t });
  generateText.mockResolvedValueOnce({ output: { linkedin: { text: 'AI body.', hashtags: ['#VRF'], firstComment: '' } }, usage: {} });
  const created = await createJob({ title: 'VRF swap', writeUp: 'Swapped VRF.', details: { location: 'Rochester' } });
  const written = await generateForJob(created.id, { sections: ['linkedin'] });
  expect(written.content.linkedin.text).toBe('New from Rochester:\n\nAI body.\n\nNeed a survey? Call 01234 567890.');
  expect(generateText.mock.calls[0][0].messages[0].content.at(-1).text).toMatch(/House templates/);
  await saveTemplates({});
});
