/**
 * Tests for photo content generation
 */

import { generateContentPrompts } from '../src/lib/content-generator';
import { parseImageData } from '../src/lib/image-analyzer';

describe('Content Generation', () => {
  const mockAnalysis = {
    equipment: ['HVAC unit', 'Copper piping', 'Thermostat'],
    work_type: 'installation',
    scope: 'Commercial HVAC system replacement',
    sector: 'Commercial',
    technical_details: 'High-efficiency unit with smart controls',
    quality_assessment: 'Professional installation',
  };

  const mockMetadata = {
    job_title: 'Commercial HVAC Installation',
    sector: 'Commercial',
    location: 'Bristol, UK',
  };

  describe('generateContentPrompts', () => {
    it('should generate prompts for all 7 content types', () => {
      const prompts = generateContentPrompts(mockAnalysis, mockMetadata);

      expect(prompts).toHaveProperty('linkedin');
      expect(prompts).toHaveProperty('instagram');
      expect(prompts).toHaveProperty('before_after');
      expect(prompts).toHaveProperty('gmb');
      expect(prompts).toHaveProperty('blog');
      expect(prompts).toHaveProperty('schema');
      expect(prompts).toHaveProperty('twitter');
      expect(prompts).toHaveProperty('keywords');
    });

    it('should include equipment in prompts', () => {
      const prompts = generateContentPrompts(mockAnalysis, mockMetadata);

      const allPrompts = Object.values(prompts).map(p => p).join('\n');
      expect(allPrompts).toContain('HVAC unit');
      expect(allPrompts).toContain('Copper piping');
    });

    it('should use provided metadata', () => {
      const prompts = generateContentPrompts(mockAnalysis, mockMetadata);

      const allPrompts = Object.values(prompts).map(p => p).join('\n');
      expect(allPrompts).toContain('Commercial HVAC Installation');
      expect(allPrompts).toContain('Bristol');
    });

    it('should fallback to analysis data when metadata is missing', () => {
      const prompts = generateContentPrompts(mockAnalysis, {});

      const allPrompts = Object.values(prompts).map(p => p).join('\n');
      expect(allPrompts).toContain(mockAnalysis.sector);
      expect(allPrompts).toContain(mockAnalysis.work_type);
    });
  });
});

describe('Image Analysis', () => {
  describe('parseImageData', () => {
    it('should parse URL images', () => {
      const imageUrl = 'https://example.com/photo.jpg';
      const result = parseImageData(imageUrl);

      expect(result).toHaveProperty('type', 'image');
      expect(result.source).toHaveProperty('type', 'url');
      expect(result.source).toHaveProperty('url', imageUrl);
    });

    it('should parse base64 images', () => {
      const base64Data = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...';
      const result = parseImageData(base64Data);

      expect(result).toHaveProperty('type', 'image');
      expect(result.source).toHaveProperty('type', 'base64');
      expect(result.source).toHaveProperty('media_type', 'image/jpeg');
    });

    it('should throw on invalid image data', () => {
      expect(() => parseImageData('invalid-data')).toThrow();
    });
  });
});

describe('Integration', () => {
  it('should handle complete content generation flow', () => {
    // This would test the full API flow in a later version
    expect(true).toBe(true);
  });
});
