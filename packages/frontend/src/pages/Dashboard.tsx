import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadDistributionCharts, BurnoutAlertsPanel, TrendsPanel } from '../components';

type TimePeriod = '7d' | '30d' | '90d' | '1y';

interface OverviewData {
  sustainability_score: number;
  burnout_risk: 'low' | 'medium' | 'high';
  active_maintainers: number;
  open_issues: number;
}

interface MaintainerMetrics {
  maintainer: string;
  pr_reviews: number;
  open_issues: number;
  avg_turnaround_hours: number;
}

type AlertType = 'high_load' | 'increasing_backlog' | 'declining_responsiveness' | 'untriaged_issues';
type AlertSeverity = 'low' | 'medium' | 'high';

interface BurnoutAlert {
  type: AlertType;
  severity: AlertSeverity;
  affected_maintainers: string[];
  metric_value: number;
  threshold: number;
  message: string;
  timestamp: string;
}

export const Dashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const repoId = searchParams.get('repo');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [maintainerMetrics, setMaintainerMetrics] = useState<MaintainerMetrics[]>([]);
  const [burnoutAlerts, setBurnoutAlerts] = useState<BurnoutAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) {
      setError('No repository selected');
      setLoading(false);
      return;
    }
    fetchOverviewData();
  }, [repoId, timePeriod]);

  const fetchOverviewData = async () => {
    if (!repoId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/repositories/${repoId}/metrics?time_period=${timePeriod}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      
      // Fetch sustainability score
      const sustainabilityResponse = await fetch(`/api/v1/repositories/${repoId}/sustainability?time_period=${timePeriod}`);
      const sustainabilityData = sustainabilityResponse.ok ? await sustainabilityResponse.json() : null;
      
      // Fetch burnout data
      const burnoutResponse = await fetch(`/api/v1/repositories/${repoId}/burnout`);
      const burnoutData = burnoutResponse.ok ? await burnoutResponse.json() : null;
      
      setOverview({
        sustainability_score: sustainabilityData?.overall_score ?? 0,
        burnout_risk: burnoutData?.overall_risk ?? 'low',
        active_maintainers: data.active_maintainers ?? 0,
        open_issues: data.open_issues ?? 0,
      });
      
      // Set maintainer metrics for charts
      setMaintainerMetrics(data.maintainer_metrics ?? []);
      
      // Set burnout alerts
      setBurnoutAlerts(burnoutData?.alerts ?? []);
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
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

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!repoId) {
    return (
      <div className="flex justify-center items-center h-64" role="alert">
        <div className="text-gray-600">Please select a repository from the list</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64" role="status" aria-live="polite">
        <div className="text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Repository Dashboard</h2>
        
        {/* Time Period Selector */}
        <div className="flex gap-2" role="group" aria-label="Time period selection">
          {(['7d', '30d', '90d', '1y'] as TimePeriod[]).map((period) => (
            <button
              key={period}
              onClick={() => handleTimePeriodChange(period)}
              aria-pressed={timePeriod === period}
              aria-label={`Show data for ${period === '7d' ? '7 days' : period === '30d' ? '30 days' : period === '90d' ? '90 days' : '1 year'}`}
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
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" role="region" aria-label="Repository overview metrics">
          {/* Sustainability Score Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500 mb-2" id="sustainability-label">Sustainability Score</div>
            <div className={`text-4xl font-bold ${getScoreColor(overview.sustainability_score)}`} aria-labelledby="sustainability-label">
              {overview.sustainability_score.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500 mt-2">out of 100</div>
          </div>

          {/* Burnout Risk Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500 mb-2" id="burnout-label">Burnout Risk</div>
            <div className="mt-2">
              <span
                className={`px-3 py-2 inline-flex text-lg font-semibold rounded-lg border ${getRiskColor(
                  overview.burnout_risk
                )}`}
                aria-labelledby="burnout-label"
                role="status"
              >
                {overview.burnout_risk.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Active Maintainers Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500 mb-2" id="maintainers-label">Active Maintainers</div>
            <div className="text-4xl font-bold text-gray-900" aria-labelledby="maintainers-label">{overview.active_maintainers}</div>
            <div className="text-xs text-gray-500 mt-2">in selected period</div>
          </div>

          {/* Open Issues Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500 mb-2" id="issues-label">Open Issues</div>
            <div className="text-4xl font-bold text-gray-900" aria-labelledby="issues-label">{overview.open_issues}</div>
            <div className="text-xs text-gray-500 mt-2">currently open</div>
          </div>
        </div>
      )}

      {/* Burnout Alerts Panel */}
      <div className="mb-8" role="region" aria-label="Burnout alerts">
        <BurnoutAlertsPanel alerts={burnoutAlerts} />
      </div>

      {/* Load Distribution Charts */}
      <div role="region" aria-label="Load distribution charts">
        <LoadDistributionCharts metrics={maintainerMetrics} />
      </div>

      {/* Trends Panel */}
      <div className="mt-8" role="region" aria-label="Trend analysis">
        <TrendsPanel repoId={repoId} timePeriod={timePeriod} />
      </div>
    </div>
  );
};
