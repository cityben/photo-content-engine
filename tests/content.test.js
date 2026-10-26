/**
 * Main building photo and photo order
 */

import { mainImageOf, orderedImages } from '../src/lib/content';

const img = (n) => ({ url: `/api/media/0000000${n}-0000-0000-0000-000000000000` });

describe('main building photo', () => {
  it('defaults to the first photo', () => {
    expect(mainImageOf({ images: [img(1), img(2)] })).toEqual(img(1));
    expect(mainImageOf({ images: [] })).toBeNull();
  });

  it('puts the chosen main photo first and keeps the rest in order', () => {
    const job = { images: [img(1), img(2), img(3)], mainImage: img(3).url };
    expect(orderedImages(job).map((i) => i.url)).toEqual([img(3).url, img(1).url, img(2).url]);
  });

  it('ignores a main photo that was removed', () => {
    expect(mainImageOf({ images: [img(1)], mainImage: img(9).url })).toEqual(img(1));
  });
});

describe('memory store queries', () => {
  const { collection } = require('../src/lib/store');
  it('matches inside arrays like MongoDB', async () => {
    const c = collection('test-arrays');
    await c.insert({ name: 'a', posts: [{ postId: 'p1' }, { postId: 'p2' }] });
    await c.insert({ name: 'b', posts: [] });
    expect((await c.find({ 'posts.postId': 'p2' })).map((d) => d.name)).toEqual(['a']);
    expect((await c.find({ name: { $in: ['b'] } })).map((d) => d.name)).toEqual(['b']);
  });
});
