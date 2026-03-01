import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface MaintainerMetrics {
  maintainer: string;
  pr_reviews: number;
  open_issues: number;
  avg_turnaround_hours: number;
}

interface LoadDistributionChartsProps {
  metrics: MaintainerMetrics[];
}

export const LoadDistributionCharts: React.FC<LoadDistributionChartsProps> = ({ metrics }) => {
  const [searchParams] = useSearchParams();
  const repoId = searchParams.get('repo');

  // Calculate high load threshold (60% of total activity)
  const totalPRReviews = metrics.reduce((sum, m) => sum + m.pr_reviews, 0);
  const highLoadThreshold = totalPRReviews * 0.6;

  // Determine which maintainers have high load
  const highLoadMaintainers = new Set(
    metrics.filter((m) => m.pr_reviews > highLoadThreshold).map((m) => m.maintainer)
  );

  // Generate colors for bars - red for high load, blue for normal
  const getBarColor = (isHighLoad: boolean) => {
    return isHighLoad ? 'rgba(239, 68, 68, 0.8)' : 'rgba(59, 130, 246, 0.8)';
  };

  const getBorderColor = (isHighLoad: boolean) => {
    return isHighLoad ? 'rgba(239, 68, 68, 1)' : 'rgba(59, 130, 246, 1)';
  };

  // PR Reviews Chart Data
  const prReviewsData = {
    labels: metrics.map((m) => m.maintainer),
    datasets: [
      {
        label: 'PR Reviews',
        data: metrics.map((m) => m.pr_reviews),
        backgroundColor: metrics.map((m) =>
          getBarColor(highLoadMaintainers.has(m.maintainer))
        ),
        borderColor: metrics.map((m) =>
          getBorderColor(highLoadMaintainers.has(m.maintainer))
        ),
        borderWidth: 2,
      },
    ],
  };

  // Open Issues Chart Data
  const openIssuesData = {
    labels: metrics.map((m) => m.maintainer),
    datasets: [
      {
        label: 'Open Issues',
        data: metrics.map((m) => m.open_issues),
        backgroundColor: metrics.map((m) =>
          getBarColor(highLoadMaintainers.has(m.maintainer))
        ),
        borderColor: metrics.map((m) =>
          getBorderColor(highLoadMaintainers.has(m.maintainer))
        ),
        borderWidth: 2,
      },
    ],
  };

  // Average Turnaround Time Chart Data
  const turnaroundData = {
    labels: metrics.map((m) => m.maintainer),
    datasets: [
      {
        label: 'Avg Turnaround (hours)',
        data: metrics.map((m) => m.avg_turnaround_hours),
        backgroundColor: metrics.map((m) =>
          getBarColor(highLoadMaintainers.has(m.maintainer))
        ),
        borderColor: metrics.map((m) =>
          getBorderColor(highLoadMaintainers.has(m.maintainer))
        ),
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  if (metrics.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6" role="status">
        <p className="text-gray-600 text-center">No maintainer metrics available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Maintainer List Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Maintainer Overview</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200" role="table" aria-label="Maintainer metrics">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Maintainer
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PR Reviews
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Open Issues
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg Turnaround
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {metrics.map((metric) => (
              <tr key={metric.maintainer} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900">{metric.maintainer}</span>
                    {highLoadMaintainers.has(metric.maintainer) && (
                      <span className="ml-2 px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded" role="status" aria-label="High load warning">
                        High Load
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {metric.pr_reviews}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {metric.open_issues}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {metric.avg_turnaround_hours.toFixed(1)} hours
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <a
                    href={`/maintainer?repo=${repoId}&maintainer=${encodeURIComponent(
                      metric.maintainer
                    )}`}
                    className="text-blue-600 hover:text-blue-900 focus:outline-none focus:underline"
                    aria-label={`View details for ${metric.maintainer}`}
                  >
                    View Details
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PR Reviews Chart */}
      <div className="bg-white rounded-lg shadow p-6" role="region" aria-label="PR reviews chart">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">PR Reviews per Maintainer</h3>
        <div className="h-64" role="img" aria-label="Bar chart showing PR reviews per maintainer">
          <Bar data={prReviewsData} options={chartOptions} />
        </div>
        <div className="mt-4 flex items-center gap-4 text-sm" role="list" aria-label="Chart legend">
          <div className="flex items-center gap-2" role="listitem">
            <div className="w-4 h-4 bg-blue-500 rounded" aria-hidden="true"></div>
            <span className="text-gray-600">Normal Load</span>
          </div>
          <div className="flex items-center gap-2" role="listitem">
            <div className="w-4 h-4 bg-red-500 rounded" aria-hidden="true"></div>
            <span className="text-gray-600">High Load (&gt;60% of total)</span>
          </div>
        </div>
      </div>

      {/* Open Issues Chart */}
      <div className="bg-white rounded-lg shadow p-6" role="region" aria-label="Open issues chart">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Open Issues per Maintainer</h3>
        <div className="h-64" role="img" aria-label="Bar chart showing open issues per maintainer">
          <Bar data={openIssuesData} options={chartOptions} />
        </div>
      </div>

      {/* Average Turnaround Time Chart */}
      <div className="bg-white rounded-lg shadow p-6" role="region" aria-label="Average turnaround time chart">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Average Review Turnaround Time
        </h3>
        <div className="h-64" role="img" aria-label="Bar chart showing average review turnaround time per maintainer">
          <Bar data={turnaroundData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};
