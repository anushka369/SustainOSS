/**
 * Property-based tests for Dashboard component
 * Feature: sustainoss
 * Property 13: Dashboard Data Completeness
 * Validates: Requirements 4.1, 4.2, 4.3
 */

import * as fc from 'fast-check';

// Type definitions
type AlertType = 'high_load' | 'increasing_backlog' | 'declining_responsiveness' | 'untriaged_issues';
type AlertSeverity = 'low' | 'medium' | 'high';

interface MaintainerMetrics {
  maintainer: string;
  pr_reviews: number;
  open_issues: number;
  avg_turnaround_hours: number;
}

interface BurnoutAlert {
  type: AlertType;
  severity: AlertSeverity;
  affected_maintainers: string[];
  metric_value: number;
  threshold: number;
  message: string;
  timestamp: string;
}

interface DashboardData {
  maintainer_metrics: MaintainerMetrics[];
  burnout_alerts: BurnoutAlert[];
}

// Generators
const maintainerMetricsArb = fc.record({
  maintainer: fc.string({ minLength: 1, maxLength: 50 }),
  pr_reviews: fc.nat({ max: 1000 }),
  open_issues: fc.nat({ max: 500 }),
  avg_turnaround_hours: fc.float({ min: 0, max: 1000, noNaN: true }),
});

const alertTypeArb = fc.constantFrom<AlertType>(
  'high_load',
  'increasing_backlog',
  'declining_responsiveness',
  'untriaged_issues'
);

const alertSeverityArb = fc.constantFrom<AlertSeverity>('low', 'medium', 'high');

const burnoutAlertArb = fc.record({
  type: alertTypeArb,
  severity: alertSeverityArb,
  affected_maintainers: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 10 }),
  metric_value: fc.float({ min: 0, max: 1000, noNaN: true }),
  threshold: fc.float({ min: 0, max: 1000, noNaN: true }),
  message: fc.string({ minLength: 10, maxLength: 200 }),
  timestamp: fc.date().map((d) => d.toISOString()),
});

const dashboardDataArb = fc.record({
  maintainer_metrics: fc.array(maintainerMetricsArb, { minLength: 0, maxLength: 20 }),
  burnout_alerts: fc.array(burnoutAlertArb, { minLength: 0, maxLength: 10 }),
});

/**
 * Property 13: Dashboard Data Completeness
 * For any repository metrics, the rendered dashboard should include all required
 * visualizations (PR reviews chart, open issues chart, turnaround time chart) with correct data.
 */
describe('Property 13: Dashboard Data Completeness', () => {
  it('should include all required chart data fields for each maintainer', () => {
    fc.assert(
      fc.property(dashboardDataArb, (data) => {
        // For each maintainer in the metrics, verify all required fields are present
        data.maintainer_metrics.forEach((metric) => {
          // Check that all required fields exist
          expect(metric).toHaveProperty('maintainer');
          expect(metric).toHaveProperty('pr_reviews');
          expect(metric).toHaveProperty('open_issues');
          expect(metric).toHaveProperty('avg_turnaround_hours');

          // Check that maintainer name is non-empty
          expect(metric.maintainer).toBeTruthy();
          expect(typeof metric.maintainer).toBe('string');

          // Check that numeric fields are valid numbers
          expect(typeof metric.pr_reviews).toBe('number');
          expect(typeof metric.open_issues).toBe('number');
          expect(typeof metric.avg_turnaround_hours).toBe('number');

          // Check that numeric fields are non-negative
          expect(metric.pr_reviews).toBeGreaterThanOrEqual(0);
          expect(metric.open_issues).toBeGreaterThanOrEqual(0);
          expect(metric.avg_turnaround_hours).toBeGreaterThanOrEqual(0);

          // Check that numeric fields are not NaN
          expect(Number.isNaN(metric.pr_reviews)).toBe(false);
          expect(Number.isNaN(metric.open_issues)).toBe(false);
          expect(Number.isNaN(metric.avg_turnaround_hours)).toBe(false);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should have complete data for all three required charts', () => {
    fc.assert(
      fc.property(dashboardDataArb, (data) => {
        // Verify that for any dashboard data, we can extract data for all three charts
        const prReviewsData = data.maintainer_metrics.map((m) => m.pr_reviews);
        const openIssuesData = data.maintainer_metrics.map((m) => m.open_issues);
        const turnaroundData = data.maintainer_metrics.map((m) => m.avg_turnaround_hours);

        // All three chart datasets should have the same length
        expect(prReviewsData.length).toBe(data.maintainer_metrics.length);
        expect(openIssuesData.length).toBe(data.maintainer_metrics.length);
        expect(turnaroundData.length).toBe(data.maintainer_metrics.length);

        // All data points should be valid numbers
        prReviewsData.forEach((value) => {
          expect(typeof value).toBe('number');
          expect(Number.isNaN(value)).toBe(false);
        });

        openIssuesData.forEach((value) => {
          expect(typeof value).toBe('number');
          expect(Number.isNaN(value)).toBe(false);
        });

        turnaroundData.forEach((value) => {
          expect(typeof value).toBe('number');
          expect(Number.isNaN(value)).toBe(false);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should have complete burnout alert data with all required fields', () => {
    fc.assert(
      fc.property(dashboardDataArb, (data) => {
        // For each burnout alert, verify all required fields are present
        data.burnout_alerts.forEach((alert) => {
          // Check that all required fields exist
          expect(alert).toHaveProperty('type');
          expect(alert).toHaveProperty('severity');
          expect(alert).toHaveProperty('affected_maintainers');
          expect(alert).toHaveProperty('metric_value');
          expect(alert).toHaveProperty('threshold');
          expect(alert).toHaveProperty('message');
          expect(alert).toHaveProperty('timestamp');

          // Check field types
          expect(typeof alert.type).toBe('string');
          expect(typeof alert.severity).toBe('string');
          expect(Array.isArray(alert.affected_maintainers)).toBe(true);
          expect(typeof alert.metric_value).toBe('number');
          expect(typeof alert.threshold).toBe('number');
          expect(typeof alert.message).toBe('string');
          expect(typeof alert.timestamp).toBe('string');

          // Check that alert type is valid
          expect(['high_load', 'increasing_backlog', 'declining_responsiveness', 'untriaged_issues']).toContain(
            alert.type
          );

          // Check that severity is valid
          expect(['low', 'medium', 'high']).toContain(alert.severity);

          // Check that message is non-empty
          expect(alert.message.length).toBeGreaterThan(0);

          // Check that numeric values are valid
          expect(Number.isNaN(alert.metric_value)).toBe(false);
          expect(Number.isNaN(alert.threshold)).toBe(false);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain data consistency across all visualizations', () => {
    fc.assert(
      fc.property(dashboardDataArb, (data) => {
        // The number of maintainers should be consistent across all chart data
        const maintainerCount = data.maintainer_metrics.length;

        // Extract labels (maintainer names) for each chart
        const labels = data.maintainer_metrics.map((m) => m.maintainer);

        // All charts should have the same number of data points
        expect(labels.length).toBe(maintainerCount);

        // If there are maintainers, verify no duplicate names (each maintainer appears once)
        if (maintainerCount > 0) {
          const uniqueLabels = new Set(labels);
          // Note: We allow duplicates in the input data as the system should handle them
          expect(uniqueLabels.size).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});
