/**
 * Tests for gateway response parsing and the UI's copy/export text
 */

import { extractJson } from '../src/lib/ai';
import { BUFFER_CHANNELS, exportMarkdown, FORMATS } from '../src/lib/formats';

jest.mock('ai', () => ({ generateText: jest.fn() }));

const byKey = Object.fromEntries(FORMATS.map((f) => [f.key, f]));

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"post":"Hi"}')).toEqual({ post: 'Hi' });
  });

  it('strips code fences and surrounding prose', () => {
    const text = 'Here you go:\n```json\n{"title":"HVAC"}\n```\nThanks';
    expect(extractJson(text)).toEqual({ title: 'HVAC' });
  });

  it('returns null when nothing parses', () => {
    expect(extractJson('no json here')).toBeNull();
    expect(extractJson('')).toBeNull();
  });
});

describe('FORMATS', () => {
  it('defines the 7 content formats', () => {
    expect(FORMATS.map((f) => f.key).sort()).toEqual(
      ['before_after', 'blog', 'gmb', 'instagram', 'linkedin', 'schema', 'twitter']
    );
  });

  it('appends hashtags that are not already in the post', () => {
    const text = byKey.linkedin.toText({ post: 'Done. #HVAC', hashtags: ['#HVAC', '#London'] });
    expect(text).toBe('Done. #HVAC\n\n#London');
  });

  it('numbers twitter threads', () => {
    const text = byKey.twitter.toText({ thread: [{ text: 'One' }, { text: 'Two' }] });
    expect(text).toBe('1/2 One\n\n2/2 Two');
  });

  it('wraps schema in a JSON-LD script tag', () => {
    const text = byKey.schema.toText({ '@type': 'LocalBusiness' });
    expect(text).toContain('<script type="application/ld+json">');
    expect(text).toContain('"@type": "LocalBusiness"');
  });

  it('falls back to raw text when the model did not return JSON', () => {
    expect(byKey.blog.toText({ text: 'Plain outline' })).toBe('Plain outline');
  });
});

describe('exportMarkdown', () => {
  it('skips failed formats and includes keywords', () => {
    const md = exportMarkdown(
      {
        content: {
          linkedin: { post: 'LinkedIn copy' },
          instagram: { error: 'rate limited' },
          keywords: { primary_keywords: ['air conditioning London'] },
        },
      },
      { job_title: 'VRF install', location: 'London' }
    );
    expect(md).toContain('# VRF install');
    expect(md).toContain('## LinkedIn post\n\nLinkedIn copy');
    expect(md).not.toContain('Instagram');
    expect(md).toContain('Primary: air conditioning London');
  });
});

describe('BUFFER_CHANNELS', () => {
  it('sends only the first tweet of a thread', () => {
    const twitter = BUFFER_CHANNELS.find((c) => c.key === 'twitter');
    expect(twitter.textFrom({ twitter: { thread: [{ text: 'Hook' }, { text: 'More' }] } })).toBe('Hook');
  });
});
