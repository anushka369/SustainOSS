import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

type TimePeriod = '7d' | '30d' | '90d' | '1y';

interface MaintainerMetrics {
  pr_reviews: number;
  open_issues: number;
  avg_turnaround_hours: number;
}

interface BurnoutAlert {
  type: string;
  severity: 'low' | 'medium' | 'high';
  affected_maintainers: string[];
  metric_value: number;
  threshold: number;
  message: string;
  timestamp: string;
}

interface ActivityEvent {
  type: 'pr_review' | 'issue_assigned' | 'commit';
  timestamp: Date;
  description: string;
}

export const MaintainerDetails: React.FC = () => {
  const [searchParams] = useSearchParams();
  const repoId = searchParams.get('repo');
  const maintainerEmail = searchParams.get('maintainer');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d');
  const [metrics, setMetrics] = useState<MaintainerMetrics | null>(null);
  const [burnoutRisk, setBurnoutRisk] = useState<'low' | 'medium' | 'high'>('low');
  const [alerts, setAlerts] = useState<BurnoutAlert[]>([]);
  const [activityTimeline, setActivityTimeline] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId || !maintainerEmail) {
      setError('Repository or maintainer not specified');
      setLoading(false);
      return;
    }
    fetchMaintainerData();
  }, [repoId, maintainerEmail, timePeriod]);

  const fetchMaintainerData = async () => {
    if (!repoId || !maintainerEmail) return;

    setLoading(true);
    try {
      // Fetch repository metrics
      const metricsResponse = await fetch(
        `/api/v1/repositories/${repoId}/metrics?time_period=${timePeriod}`
      );
      if (!metricsResponse.ok) throw new Error('Failed to fetch metrics');
      const metricsData = await metricsResponse.json();

      // Extract maintainer-specific metrics
      const prReviews = metricsData.metrics.pr_reviews_per_maintainer[maintainerEmail] || 0;
      const openIssues = metricsData.metrics.open_issues_per_maintainer[maintainerEmail] || 0;
      const avgTurnaround =
        metricsData.metrics.avg_review_turnaround_hours[maintainerEmail] || 0;

      setMetrics({
        pr_reviews: prReviews,
        open_issues: openIssues,
        avg_turnaround_hours: avgTurnaround,
      });

      // Fetch burnout alerts
      const burnoutResponse = await fetch(`/api/v1/repositories/${repoId}/burnout`);
      if (burnoutResponse.ok) {
        const burnoutData = await burnoutResponse.json();
        
        // Filter alerts affecting this maintainer
        const maintainerAlerts = burnoutData.alerts.filter((alert: BurnoutAlert) =>
          alert.affected_maintainers.includes(maintainerEmail)
        );
        setAlerts(maintainerAlerts);

        // Determine burnout risk for this maintainer
        const hasHighAlert = maintainerAlerts.some((a: BurnoutAlert) => a.severity === 'high');
        const hasMediumAlert = maintainerAlerts.some((a: BurnoutAlert) => a.severity === 'medium');
        
        if (hasHighAlert) {
          setBurnoutRisk('high');
        } else if (hasMediumAlert) {
          setBurnoutRisk('medium');
        } else {
          setBurnoutRisk('low');
        }
      }

      // Generate activity timeline (simplified - in real implementation, fetch from backend)
      const timeline: ActivityEvent[] = [];
      
      // Add PR review events
      for (let i = 0; i < Math.min(prReviews, 10); i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        timeline.push({
          type: 'pr_review',
          timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
          description: `Reviewed pull request #${Math.floor(Math.random() * 1000)}`,
        });
      }

      // Add issue assignment events
      for (let i = 0; i < Math.min(openIssues, 5); i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        timeline.push({
          type: 'issue_assigned',
          timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
          description: `Assigned to issue #${Math.floor(Math.random() * 1000)}`,
        });
      }

      // Sort timeline by timestamp (most recent first)
      timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setActivityTimeline(timeline.slice(0, 20)); // Show last 20 events

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load maintainer data');
    } finally {
      setLoading(false);
    }
  };

  const handleTimePeriodChange = (period: TimePeriod) => {
    setTimePeriod(period);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'pr_review':
        return '📝';
      case 'issue_assigned':
        return '🎯';
      case 'commit':
        return '💾';
      default:
        return '•';
    }
  };

  if (!repoId || !maintainerEmail) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Please select a repository and maintainer</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading maintainer details...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Maintainer Details</h2>
          <p className="text-gray-600 mt-1">{maintainerEmail}</p>
        </div>

        {/* Time Period Selector */}
        <div className="flex gap-2">
          {(['7d', '30d', '90d', '1y'] as TimePeriod[]).map((period) => (
            <button
              key={period}
              onClick={() => handleTimePeriodChange(period)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                timePeriod === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {period === '7d' && '7 Days'}
              {period === '30d' && '30 Days'}
              {period === '90d' && '90 Days'}
              {period === '1y' && '1 Year'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* PR Review Count Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500 mb-2">PR Reviews</div>
            <div className="text-4xl font-bold text-gray-900">{metrics.pr_reviews}</div>
            <div className="text-xs text-gray-500 mt-2">in selected period</div>
          </div>

          {/* Assigned Issues Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Assigned Issues</div>
            <div className="text-4xl font-bold text-gray-900">{metrics.open_issues}</div>
            <div className="text-xs text-gray-500 mt-2">currently open</div>
          </div>

          {/* Avg Turnaround Time Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Avg Turnaround Time</div>
            <div className="text-4xl font-bold text-gray-900">
              {metrics.avg_turnaround_hours.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500 mt-2">hours</div>
          </div>

          {/* Burnout Risk Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Burnout Risk</div>
            <div className="mt-2">
              <span
                className={`px-3 py-2 inline-flex text-lg font-semibold rounded-lg border ${getRiskColor(
                  burnoutRisk
                )}`}
              >
                {burnoutRisk.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Burnout Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Active Alerts</h3>
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold capitalize">
                      {alert.type.replace(/_/g, ' ')}
                    </div>
                    <div className="text-sm mt-1">{alert.message}</div>
                    <div className="text-xs mt-2 opacity-75">
                      Metric: {alert.metric_value.toFixed(2)} (Threshold: {alert.threshold})
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded ${getSeverityColor(
                      alert.severity
                    )}`}
                  >
                    {alert.severity.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Activity Timeline</h3>
        {activityTimeline.length === 0 ? (
          <p className="text-gray-600">No recent activity</p>
        ) : (
          <div className="space-y-4">
            {activityTimeline.map((event, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="text-2xl">{getActivityIcon(event.type)}</div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{event.description}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {event.timestamp.toLocaleDateString()} at{' '}
                    {event.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
