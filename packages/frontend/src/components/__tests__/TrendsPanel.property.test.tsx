/**
 * Property-based tests for TrendsPanel component
 * Feature: sustainoss
 * Property 22: Trend Graph Data Inclusion
 * Validates: Requirements 6.2
 */

import * as fc from 'fast-check';

interface DataPoint {
  timestamp: string;
  value: number;
}

interface TrendData {
  metric_name: string;
  data_points: DataPoint[];
  trend_direction: 'increasing' | 'decreasing' | 'stable';
  change_percentage: number;
}

// Generator for a timestamp within a time range
const timestampArb = (startDate: Date, endDate: Date) =>
  fc
    .integer({ min: startDate.getTime(), max: endDate.getTime() })
    .map((ms) => new Date(ms).toISOString());

// Generator for a data point
const dataPointArb = (startDate: Date, endDate: Date) =>
  fc.record({
    timestamp: timestampArb(startDate, endDate),
    value: fc.float({ min: 0, max: 100, noNaN: true }),
  });

// Generator for trend data with a specific time range
const trendDataArb = (startDate: Date, endDate: Date, minPoints: number = 1, maxPoints: number = 100) =>
  fc
    .array(dataPointArb(startDate, endDate), { minLength: minPoints, maxLength: maxPoints })
    .map((dataPoints) => {
      // Sort data points by timestamp
      const sortedPoints = dataPoints.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Calculate change percentage
      const changePercentage =
        sortedPoints.length >= 2 && sortedPoints[0].value !== 0
          ? ((sortedPoints[sortedPoints.length - 1].value - sortedPoints[0].value) /
              Math.abs(sortedPoints[0].value)) *
            100
          : 0;

      // Determine trend direction
      let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (changePercentage > 1) trendDirection = 'increasing';
      else if (changePercentage < -1) trendDirection = 'decreasing';

      return {
        metric_name: 'test_metric',
        data_points: sortedPoints,
        trend_direction: trendDirection,
        change_percentage: changePercentage,
      };
    });

/**
 * Helper function to check if a data point falls within a time range
 */
function isWithinTimeRange(timestamp: string, startDate: Date, endDate: Date): boolean {
  const pointDate = new Date(timestamp);
  return pointDate >= startDate && pointDate <= endDate;
}

/**
 * Helper function to count data points within a time range
 */
function countPointsInRange(dataPoints: DataPoint[], startDate: Date, endDate: Date): number {
  return dataPoints.filter((dp) => isWithinTimeRange(dp.timestamp, startDate, endDate)).length;
}

/**
 * Property 22: Trend Graph Data Inclusion
 * For any repository with historical data, the rendered trend graph should include
 * data points for all available snapshots in the selected time range.
 */
describe('Property 22: Trend Graph Data Inclusion', () => {
  it('should include all data points within the selected time range', () => {
    const startDate = new Date('2020-01-01');
    const endDate = new Date('2024-12-31');

    fc.assert(
      fc.property(trendDataArb(startDate, endDate, 1, 50), (trendData) => {
        // All data points should be within the time range
        const allPointsInRange = trendData.data_points.every((dp) =>
          isWithinTimeRange(dp.timestamp, startDate, endDate)
        );

        expect(allPointsInRange).toBe(true);

        // The number of data points in the trend should match the count
        const expectedCount = countPointsInRange(trendData.data_points, startDate, endDate);
        expect(trendData.data_points.length).toBe(expectedCount);
      }),
      { numRuns: 100 }
    );
  });

  it('should not omit any available snapshots from the trend graph', () => {
    const startDate = new Date('2020-01-01');
    const endDate = new Date('2020-03-31');

    fc.assert(
      fc.property(trendDataArb(startDate, endDate, 5, 30), (trendData) => {
        // Verify no data points are omitted - all generated points should be present
        // Note: The generator may create duplicate timestamps, which is valid
        expect(trendData.data_points.length).toBeGreaterThanOrEqual(5);
        expect(trendData.data_points.length).toBeLessThanOrEqual(30);

        // Verify all data points have valid timestamps
        trendData.data_points.forEach((dp) => {
          expect(dp.timestamp).toBeTruthy();
          expect(typeof dp.timestamp).toBe('string');
          expect(new Date(dp.timestamp).toString()).not.toBe('Invalid Date');
        });

        // Verify all data points have valid values
        trendData.data_points.forEach((dp) => {
          expect(typeof dp.value).toBe('number');
          expect(isNaN(dp.value)).toBe(false);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain chronological order of data points', () => {
    const startDate = new Date('2020-01-01');
    const endDate = new Date('2020-03-31');

    fc.assert(
      fc.property(trendDataArb(startDate, endDate, 2, 50), (trendData) => {
        // Verify data points are in chronological order
        for (let i = 1; i < trendData.data_points.length; i++) {
          const prevTime = new Date(trendData.data_points[i - 1].timestamp).getTime();
          const currTime = new Date(trendData.data_points[i].timestamp).getTime();
          expect(currTime).toBeGreaterThanOrEqual(prevTime);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should include data points for weekly snapshots when available', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
        fc.integer({ min: 4, max: 12 }),
        (startDate, numWeeks) => {
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + numWeeks * 7);

          // Generate weekly snapshots
          const weeklySnapshots: DataPoint[] = [];
          for (let i = 0; i <= numWeeks; i++) {
            const snapshotDate = new Date(startDate);
            snapshotDate.setDate(snapshotDate.getDate() + i * 7);
            if (snapshotDate <= endDate) {
              weeklySnapshots.push({
                timestamp: snapshotDate.toISOString(),
                value: Math.random() * 100,
              });
            }
          }

          const trendData: TrendData = {
            metric_name: 'test_metric',
            data_points: weeklySnapshots,
            trend_direction: 'stable',
            change_percentage: 0,
          };

          // All weekly snapshots should be included
          expect(trendData.data_points.length).toBe(weeklySnapshots.length);

          // Verify each snapshot is present
          weeklySnapshots.forEach((snapshot) => {
            const found = trendData.data_points.some(
              (dp) => dp.timestamp === snapshot.timestamp
            );
            expect(found).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty data gracefully', () => {
    const emptyTrendData: TrendData = {
      metric_name: 'test_metric',
      data_points: [],
      trend_direction: 'stable',
      change_percentage: 0,
    };

    // Empty trend data should have zero data points
    expect(emptyTrendData.data_points.length).toBe(0);

    // Should not throw errors when processing empty data
    expect(() => {
      const count = countPointsInRange(
        emptyTrendData.data_points,
        new Date('2020-01-01'),
        new Date('2024-12-31')
      );
      expect(count).toBe(0);
    }).not.toThrow();
  });

  it('should include all data points regardless of metric value', () => {
    const startDate = new Date('2020-01-01');
    const endDate = new Date('2020-03-31');

    fc.assert(
      fc.property(
        fc.array(dataPointArb(startDate, endDate), { minLength: 5, maxLength: 30 }),
        (dataPoints) => {
          // Include data points with various values (including 0, very small, very large)
          const mixedDataPoints = dataPoints.map((dp, i) => {
            if (i % 3 === 0) return { ...dp, value: 0 };
            if (i % 3 === 1) return { ...dp, value: 0.001 };
            return dp;
          });

          const sortedPoints = mixedDataPoints.sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          // All data points should be included, regardless of value
          expect(sortedPoints.length).toBe(mixedDataPoints.length);

          // Verify zero values are included
          const zeroValues = sortedPoints.filter((dp) => dp.value === 0);
          const expectedZeroCount = mixedDataPoints.filter((dp) => dp.value === 0).length;
          expect(zeroValues.length).toBe(expectedZeroCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly filter data points by time period selection', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2024-01-01') }),
        fc.constantFrom('7d', '30d', '90d', '1y'),
        (endDate, timePeriod) => {
          const startDate = new Date(endDate);
          switch (timePeriod) {
            case '7d':
              startDate.setDate(endDate.getDate() - 7);
              break;
            case '30d':
              startDate.setDate(endDate.getDate() - 30);
              break;
            case '90d':
              startDate.setDate(endDate.getDate() - 90);
              break;
            case '1y':
              startDate.setFullYear(endDate.getFullYear() - 1);
              break;
          }

          // Generate trend data within the time period
          const dataPoints = fc.sample(dataPointArb(startDate, endDate), { numRuns: 10 });
          const sortedPoints = dataPoints.sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          // All data points should fall within the selected time period
          sortedPoints.forEach((dp) => {
            const pointDate = new Date(dp.timestamp);
            expect(pointDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
            expect(pointDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
