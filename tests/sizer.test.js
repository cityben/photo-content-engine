/**
 * Social sizer geometry
 */

import { ALL_SIZES, cropRect, extendLayout, fileName, fitRect, keptShare, ratioLabel, safeArea, sizesInSet, subjectInside } from '../src/lib/sizer';

describe('sizes', () => {
  it('lists every platform size with its shape', () => {
    expect(ALL_SIZES).toHaveLength(19);
    expect(ratioLabel(1080, 1350)).toBe('4:5');
    expect(ratioLabel(1080, 1920)).toBe('9:16');
    expect(ratioLabel(1200, 627)).toBe('1.91:1');
    expect(ratioLabel(1128, 191)).toBe('5.91:1');
    expect(sizesInSet('stories')).toEqual(['ig-story', 'fb-story', 'tt-video', 'pin-standard']);
  });
});

describe('cropRect', () => {
  const W = 4000;
  const H = 3000; // 4:3 landscape photo

  it('takes the largest area of the target shape, centred on the subject', () => {
    const r = cropRect(W, H, 1080, 1350, { fx: 0.5, fy: 0.5 });
    expect(r.sh).toBe(3000);
    expect(r.sw).toBe(2400);
    expect(r.sx).toBe(800);
    expect(subjectInside(W, H, r, 0.5, 0.5)).toBe(true);
  });

  it('follows the subject point and stays inside the photo', () => {
    expect(cropRect(W, H, 1080, 1350, { fx: 0.9 }).sx).toBe(1600); // clamped to the right edge
    expect(cropRect(W, H, 1080, 1350, { fx: 0.1 }).sx).toBe(0);
  });

  it('zooms and pans', () => {
    const r = cropRect(W, H, 1000, 1000, { zoom: 2, dx: 300 });
    expect(r.sw).toBe(1500);
    expect(r.sx).toBe(2000 - 750 + 300);
  });

  it('reports how hard a size crops', () => {
    expect(keptShare(W, H, cropRect(W, H, 1128, 191))).toBeLessThan(0.25);
  });
});

describe('safe area', () => {
  it('is what survives every crop', () => {
    const rects = [cropRect(4000, 3000, 1080, 1350), cropRect(4000, 3000, 1200, 627)];
    const s = safeArea(rects);
    expect(s).toMatchObject({ x: 800, w: 2400 });
    expect(s.h).toBeCloseTo(4000 / (1200 / 627), 0);
    expect(safeArea([{ sx: 0, sy: 0, sw: 10, sh: 10 }, { sx: 20, sy: 0, sw: 10, sh: 10 }])).toBeNull();
  });
});

describe('fit and extend', () => {
  it('letterboxes the whole photo', () => {
    expect(fitRect(4000, 3000, 1080, 1920)).toEqual({ dx: 0, dy: (1920 - 810) / 2, dw: 1080, dh: 810 });
  });

  it('places the photo inside a model canvas region of the target shape', () => {
    const l = extendLayout(4000, 3000, 1080, 1920);
    expect(l.canvas).toEqual({ w: 1024, h: 1536 });
    expect(l.region.h).toBe(1536);
    expect(l.region.w).toBeCloseTo(864, 0);
    expect(l.photo.w).toBeCloseTo(864, 0); // full width, edges above and below to fill
  });

  it('names files by photo, platform and size', () => {
    expect(fileName('Site Photo 1.JPG', ALL_SIZES[0], 'image/jpeg')).toBe('site-photo-1-linkedin-feed-portrait-1080x1350.jpg');
  });
});
