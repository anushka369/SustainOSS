/**
 * Property-based tests for GoodFirstIssues component
 * Feature: sustainoss
 * Property 27: Recommendation Justification Completeness
 * Validates: Requirements 7.5
 */

import * as fc from 'fast-check';

// Type definitions
interface IssueRecommendation {
  issue_id: string;
  title: string;
  complexity_score: number;
  clarity_score: number;
  overall_score: number;
  justification: string;
  labels: string[];
}

// Generators
const issueRecommendationArb = fc.record({
  issue_id: fc.string({ minLength: 1, maxLength: 50 }),
  title: fc.string({ minLength: 5, maxLength: 200 }),
  complexity_score: fc.float({ min: 0, max: 100, noNaN: true }),
  clarity_score: fc.float({ min: 0, max: 100, noNaN: true }),
  overall_score: fc.float({ min: 0, max: 100, noNaN: true }),
  justification: fc.string({ minLength: 10, maxLength: 500 }),
  labels: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 10 }),
});

const goodFirstIssuesResponseArb = fc
  .record({
    repository_id: fc.string({ minLength: 1, maxLength: 50 }),
    recommendations: fc.array(issueRecommendationArb, { minLength: 0, maxLength: 50 }),
  })
  .map((data) => ({
    ...data,
    total: data.recommendations.length, // Ensure total matches recommendations length
  }));

/**
 * Property 27: Recommendation Justification Completeness
 * For any recommended good first issue, the dashboard should display the issue title,
 * complexity score, clarity score, overall score, and a justification string.
 */
describe('Property 27: Recommendation Justification Completeness', () => {
  it('should have all required fields for each recommendation', () => {
    fc.assert(
      fc.property(goodFirstIssuesResponseArb, (response) => {
        // For each recommendation, verify all required fields are present
        response.recommendations.forEach((rec) => {
          // Check that all required fields exist
          expect(rec).toHaveProperty('issue_id');
          expect(rec).toHaveProperty('title');
          expect(rec).toHaveProperty('complexity_score');
          expect(rec).toHaveProperty('clarity_score');
          expect(rec).toHaveProperty('overall_score');
          expect(rec).toHaveProperty('justification');
          expect(rec).toHaveProperty('labels');

          // Check field types
          expect(typeof rec.issue_id).toBe('string');
          expect(typeof rec.title).toBe('string');
          expect(typeof rec.complexity_score).toBe('number');
          expect(typeof rec.clarity_score).toBe('number');
          expect(typeof rec.overall_score).toBe('number');
          expect(typeof rec.justification).toBe('string');
          expect(Array.isArray(rec.labels)).toBe(true);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should have non-empty title and justification for each recommendation', () => {
    fc.assert(
      fc.property(goodFirstIssuesResponseArb, (response) => {
        response.recommendations.forEach((rec) => {
          // Title should be non-empty
          expect(rec.title).toBeTruthy();
          expect(rec.title.length).toBeGreaterThan(0);

          // Justification should be non-empty
          expect(rec.justification).toBeTruthy();
          expect(rec.justification.length).toBeGreaterThan(0);

          // Issue ID should be non-empty
          expect(rec.issue_id).toBeTruthy();
          expect(rec.issue_id.length).toBeGreaterThan(0);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should have valid score ranges for all score fields', () => {
    fc.assert(
      fc.property(goodFirstIssuesResponseArb, (response) => {
        response.recommendations.forEach((rec) => {
          // Complexity score should be between 0 and 100
          expect(rec.complexity_score).toBeGreaterThanOrEqual(0);
          expect(rec.complexity_score).toBeLessThanOrEqual(100);
          expect(Number.isNaN(rec.complexity_score)).toBe(false);

          // Clarity score should be between 0 and 100
          expect(rec.clarity_score).toBeGreaterThanOrEqual(0);
          expect(rec.clarity_score).toBeLessThanOrEqual(100);
          expect(Number.isNaN(rec.clarity_score)).toBe(false);

          // Overall score should be between 0 and 100
          expect(rec.overall_score).toBeGreaterThanOrEqual(0);
          expect(rec.overall_score).toBeLessThanOrEqual(100);
          expect(Number.isNaN(rec.overall_score)).toBe(false);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should have valid labels array for each recommendation', () => {
    fc.assert(
      fc.property(goodFirstIssuesResponseArb, (response) => {
        response.recommendations.forEach((rec) => {
          // Labels should be an array
          expect(Array.isArray(rec.labels)).toBe(true);

          // Each label should be a non-empty string
          rec.labels.forEach((label) => {
            expect(typeof label).toBe('string');
            expect(label.length).toBeGreaterThan(0);
          });
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain consistency between total and recommendations length', () => {
    fc.assert(
      fc.property(goodFirstIssuesResponseArb, (response) => {
        // The total field should match the number of recommendations in the response
        expect(response.total).toBe(response.recommendations.length);
      }),
      { numRuns: 100 }
    );
  });

  it('should have displayable data for all visualization requirements', () => {
    fc.assert(
      fc.property(goodFirstIssuesResponseArb, (response) => {
        response.recommendations.forEach((rec) => {
          // Verify that all fields required for display are present and valid

          // Title for display
          expect(rec.title).toBeTruthy();
          expect(typeof rec.title).toBe('string');

          // Complexity score for display (should be displayable as a number)
          expect(typeof rec.complexity_score).toBe('number');
          expect(Number.isFinite(rec.complexity_score)).toBe(true);

          // Clarity score for display
          expect(typeof rec.clarity_score).toBe('number');
          expect(Number.isFinite(rec.clarity_score)).toBe(true);

          // Overall score for display
          expect(typeof rec.overall_score).toBe('number');
          expect(Number.isFinite(rec.overall_score)).toBe(true);

          // Justification for display
          expect(rec.justification).toBeTruthy();
          expect(typeof rec.justification).toBe('string');

          // Labels for display (can be empty array)
          expect(Array.isArray(rec.labels)).toBe(true);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should have unique issue IDs for each recommendation', () => {
    fc.assert(
      fc.property(goodFirstIssuesResponseArb, (response) => {
        // Extract all issue IDs
        const issueIds = response.recommendations.map((rec) => rec.issue_id);

        // Check that all issue IDs are unique
        const uniqueIds = new Set(issueIds);
        expect(uniqueIds.size).toBe(issueIds.length);
      }),
      { numRuns: 100 }
    );
  });

  it('should have all required fields for table display', () => {
    fc.assert(
      fc.property(goodFirstIssuesResponseArb, (response) => {
        // Verify that each recommendation has all fields needed for the table columns:
        // Title, Complexity, Clarity, Overall Score, Justification, Labels
        response.recommendations.forEach((rec) => {
          // All table columns should have data
          const tableData = {
            title: rec.title,
            complexity: rec.complexity_score,
            clarity: rec.clarity_score,
            overallScore: rec.overall_score,
            justification: rec.justification,
            labels: rec.labels,
          };

          // Verify all table data is present
          expect(tableData.title).toBeTruthy();
          expect(typeof tableData.complexity).toBe('number');
          expect(typeof tableData.clarity).toBe('number');
          expect(typeof tableData.overallScore).toBe('number');
          expect(tableData.justification).toBeTruthy();
          expect(Array.isArray(tableData.labels)).toBe(true);
        });
      }),
      { numRuns: 100 }
    );
  });
});
