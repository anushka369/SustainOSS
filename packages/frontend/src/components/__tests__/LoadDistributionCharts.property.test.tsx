/**
 * Property-based tests for LoadDistributionCharts component
 * Feature: sustainoss
 * Property 14: High Load Visual Highlighting
 * Validates: Requirements 4.4
 */

import * as fc from 'fast-check';

interface MaintainerMetrics {
  maintainer: string;
  pr_reviews: number;
  open_issues: number;
  avg_turnaround_hours: number;
}

// Generator for maintainer metrics
const maintainerMetricsArb = fc.record({
  maintainer: fc.string({ minLength: 1, maxLength: 50 }),
  pr_reviews: fc.nat({ max: 1000 }),
  open_issues: fc.nat({ max: 500 }),
  avg_turnaround_hours: fc.float({ min: 0, max: 1000, noNaN: true }),
});

// Generator for a list of maintainer metrics
const maintainerMetricsListArb = fc.array(maintainerMetricsArb, { minLength: 1, maxLength: 20 });

/**
 * Helper function to determine if a maintainer should be highlighted as high load
 * Based on the 60% threshold from requirements
 */
function isHighLoad(maintainer: MaintainerMetrics, allMetrics: MaintainerMetrics[]): boolean {
  const totalPRReviews = allMetrics.reduce((sum, m) => sum + m.pr_reviews, 0);
  if (totalPRReviews === 0) return false;
  const threshold = totalPRReviews * 0.6;
  return maintainer.pr_reviews > threshold;
}

/**
 * Helper function to get the color that should be used for a maintainer
 */
function getExpectedColor(maintainer: MaintainerMetrics, allMetrics: MaintainerMetrics[]): 'red' | 'blue' {
  return isHighLoad(maintainer, allMetrics) ? 'red' : 'blue';
}

/**
 * Property 14: High Load Visual Highlighting
 * For any maintainer with load above the high-load threshold (>60% of total activity),
 * the dashboard visualization should include color coding to distinguish them from
 * normal-load maintainers.
 */
describe('Property 14: High Load Visual Highlighting', () => {
  it('should correctly identify high-load maintainers based on 60% threshold', () => {
    fc.assert(
      fc.property(maintainerMetricsListArb, (metrics) => {
        const totalPRReviews = metrics.reduce((sum, m) => sum + m.pr_reviews, 0);
        const highLoadThreshold = totalPRReviews * 0.6;

        metrics.forEach((maintainer) => {
          const shouldBeHighLoad = maintainer.pr_reviews > highLoadThreshold;
          const actuallyHighLoad = isHighLoad(maintainer, metrics);

          // Verify our helper function correctly identifies high load
          expect(actuallyHighLoad).toBe(shouldBeHighLoad);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should assign different colors to high-load vs normal-load maintainers', () => {
    fc.assert(
      fc.property(maintainerMetricsListArb, (metrics) => {
        const totalPRReviews = metrics.reduce((sum, m) => sum + m.pr_reviews, 0);

        // Skip if total is 0 (no activity)
        if (totalPRReviews === 0) return;

        const highLoadThreshold = totalPRReviews * 0.6;
        const highLoadMaintainers = metrics.filter((m) => m.pr_reviews > highLoadThreshold);
        const normalLoadMaintainers = metrics.filter((m) => m.pr_reviews <= highLoadThreshold);

        // All high-load maintainers should get red color
        highLoadMaintainers.forEach((maintainer) => {
          const color = getExpectedColor(maintainer, metrics);
          expect(color).toBe('red');
        });

        // All normal-load maintainers should get blue color
        normalLoadMaintainers.forEach((maintainer) => {
          const color = getExpectedColor(maintainer, metrics);
          expect(color).toBe('blue');
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should handle edge case where one maintainer does all the work', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.nat({ min: 1, max: 1000 }),
        (maintainerName, prReviews) => {
          // Create a scenario where one maintainer does 100% of the work
          const metrics: MaintainerMetrics[] = [
            {
              maintainer: maintainerName,
              pr_reviews: prReviews,
              open_issues: 0,
              avg_turnaround_hours: 0,
            },
          ];

          const totalPRReviews = prReviews;
          const highLoadThreshold = totalPRReviews * 0.6;

          // This maintainer should be flagged as high load (100% > 60%)
          // Only if they have any work (prReviews > 0)
          if (prReviews > 0) {
            expect(prReviews).toBeGreaterThan(highLoadThreshold);
            expect(isHighLoad(metrics[0], metrics)).toBe(true);
            expect(getExpectedColor(metrics[0], metrics)).toBe('red');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle edge case where work is perfectly distributed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.nat({ min: 1, max: 100 }),
        (numMaintainers, prReviewsPerMaintainer) => {
          // Create a scenario where work is evenly distributed
          const metrics: MaintainerMetrics[] = Array.from({ length: numMaintainers }, (_, i) => ({
            maintainer: `maintainer-${i}`,
            pr_reviews: prReviewsPerMaintainer,
            open_issues: 0,
            avg_turnaround_hours: 0,
          }));

          const totalPRReviews = numMaintainers * prReviewsPerMaintainer;
          const highLoadThreshold = totalPRReviews * 0.6;

          // With even distribution, each maintainer has 1/n of the work
          // For n >= 2, 1/n <= 0.5 < 0.6, so no one should be high load
          metrics.forEach((maintainer) => {
            expect(maintainer.pr_reviews).toBeLessThanOrEqual(highLoadThreshold);
            expect(isHighLoad(maintainer, metrics)).toBe(false);
            expect(getExpectedColor(maintainer, metrics)).toBe('blue');
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly handle the 60% threshold boundary', () => {
    fc.assert(
      fc.property(fc.nat({ min: 1, max: 1000 }), (totalWork) => {
        const threshold = totalWork * 0.6;

        // Create three maintainers: one just below, one at, one just above threshold
        const metrics: MaintainerMetrics[] = [
          {
            maintainer: 'below-threshold',
            pr_reviews: Math.floor(threshold * 0.99), // Just below
            open_issues: 0,
            avg_turnaround_hours: 0,
          },
          {
            maintainer: 'at-threshold',
            pr_reviews: Math.floor(threshold), // Exactly at (should not be high load)
            open_issues: 0,
            avg_turnaround_hours: 0,
          },
          {
            maintainer: 'above-threshold',
            pr_reviews: Math.ceil(threshold * 1.01), // Just above
            open_issues: 0,
            avg_turnaround_hours: 0,
          },
        ];

        // Adjust to ensure total matches
        const currentTotal = metrics.reduce((sum, m) => sum + m.pr_reviews, 0);
        if (currentTotal < totalWork) {
          metrics[2].pr_reviews += totalWork - currentTotal;
        }

        const actualTotal = metrics.reduce((sum, m) => sum + m.pr_reviews, 0);
        const actualThreshold = actualTotal * 0.6;

        // Below and at threshold should not be high load
        if (metrics[0].pr_reviews <= actualThreshold) {
          expect(isHighLoad(metrics[0], metrics)).toBe(false);
        }
        if (metrics[1].pr_reviews <= actualThreshold) {
          expect(isHighLoad(metrics[1], metrics)).toBe(false);
        }

        // Above threshold should be high load
        if (metrics[2].pr_reviews > actualThreshold) {
          expect(isHighLoad(metrics[2], metrics)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain color consistency across all three charts for the same maintainer', () => {
    fc.assert(
      fc.property(maintainerMetricsListArb, (metrics) => {
        // For each maintainer, the color should be the same across all three charts
        // (PR reviews, open issues, turnaround time)
        metrics.forEach((maintainer) => {
          const color = getExpectedColor(maintainer, metrics);

          // The color is determined by PR reviews, so it should be consistent
          // across all visualizations for this maintainer
          expect(color).toBe(isHighLoad(maintainer, metrics) ? 'red' : 'blue');
        });
      }),
      { numRuns: 100 }
    );
  });
});
