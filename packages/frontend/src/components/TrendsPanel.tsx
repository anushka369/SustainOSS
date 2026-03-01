import React, { useState, useEffect } from 'react';
import { TrendChart } from './TrendChart';

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

interface TrendsPanelProps {
  repoId: string;
  timePeriod: '7d' | '30d' | '90d' | '1y';
}

type MetricKey =
  | 'sustainability_score'
  | 'contributor_diversity'
  | 'load_distribution_score'
  | 'response_time_score'
  | 'retention_ratio';

const METRIC_DISPLAY_NAMES: Record<MetricKey, string> = {
  sustainability_score: 'Sustainability Score',
  contributor_diversity: 'Contributor Diversity',
  load_distribution_score: 'Load Distribution Score',
  response_time_score: 'Response Time Score',
  retention_ratio: 'Retention Ratio',
};

export const TrendsPanel: React.FC<TrendsPanelProps> = ({ repoId, timePeriod }) => {
  const [trends, setTrends] = useState<Record<string, TrendData>>({});
  const [baselines, setBaselines] = useState<Record<string, { date: string; value: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrends();
  }, [repoId, timePeriod]);

  const fetchTrends = async () => {
    setLoading(true);
    setError(null);

    try {
      const metricsToFetch: MetricKey[] = [
        'sustainability_score',
        'contributor_diversity',
        'load_distribution_score',
        'response_time_score',
        'retention_ratio',
      ];

      const trendPromises = metricsToFetch.map(async (metricName) => {
        const response = await fetch(
          `/api/v1/repositories/${repoId}/trends?metric_name=${metricName}&time_range=${timePeriod}`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch trends for ${metricName}`);
        }
        const data = await response.json();
        return { metricName, data };
      });

      const results = await Promise.all(trendPromises);

      const trendsMap: Record<string, TrendData> = {};
      const baselinesMap: Record<string, { date: string; value: number }> = {};

      results.forEach(({ metricName, data }) => {
        trendsMap[metricName] = data;

        // Calculate baseline (value from 30 days ago if available)
        if (data.data_points.length > 0) {
          const baselineDate = new Date();
          baselineDate.setDate(baselineDate.getDate() - 30);

          // Find closest data point to 30 days ago
          const baselinePoint = data.data_points.reduce(
            (closest: DataPoint | null, point: DataPoint) => {
              const pointDate = new Date(point.timestamp);
              const closestDate = closest ? new Date(closest.timestamp) : new Date(0);
              const pointDiff = Math.abs(pointDate.getTime() - baselineDate.getTime());
              const closestDiff = Math.abs(closestDate.getTime() - baselineDate.getTime());
              return pointDiff < closestDiff ? point : closest;
            },
            null
          );

          if (baselinePoint) {
            baselinesMap[metricName] = {
              date: baselinePoint.timestamp,
              value: baselinePoint.value,
            };
          }
        }
      });

      setTrends(trendsMap);
      setBaselines(baselinesMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trend data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-600">Loading trends...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  const metricsToDisplay: MetricKey[] = [
    'sustainability_score',
    'contributor_diversity',
    'load_distribution_score',
    'response_time_score',
    'retention_ratio',
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Historical Trends</h2>
      </div>

      {metricsToDisplay.map((metricKey) => {
        const trend = trends[metricKey];
        if (!trend || trend.data_points.length === 0) {
          return null;
        }

        return (
          <TrendChart
            key={metricKey}
            metricName={METRIC_DISPLAY_NAMES[metricKey]}
            dataPoints={trend.data_points}
            trendDirection={trend.trend_direction}
            changePercentage={trend.change_percentage}
            baseline={baselines[metricKey]}
          />
        );
      })}

      {Object.keys(trends).length === 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-center text-gray-600">No trend data available for this repository</p>
        </div>
      )}
    </div>
  );
};
