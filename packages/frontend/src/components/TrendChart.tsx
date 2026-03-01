import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface DataPoint {
  timestamp: string;
  value: number;
}

interface TrendChartProps {
  metricName: string;
  dataPoints: DataPoint[];
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
  baseline?: { date: string; value: number };
}

export const TrendChart: React.FC<TrendChartProps> = ({
  metricName,
  dataPoints,
  trendDirection,
  changePercentage,
  baseline,
}) => {
  // Check if change is significant (> 30%)
  const isSignificantChange = Math.abs(changePercentage) > 30;

  // Format dates for labels
  const labels = dataPoints.map((dp) => {
    const date = new Date(dp.timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const values = dataPoints.map((dp) => dp.value);

  // Determine line color based on trend direction
  const getLineColor = () => {
    if (trendDirection === 'increasing') return 'rgba(34, 197, 94, 0.8)'; // green
    if (trendDirection === 'decreasing') return 'rgba(239, 68, 68, 0.8)'; // red
    return 'rgba(59, 130, 246, 0.8)'; // blue
  };

  const getBorderColor = () => {
    if (trendDirection === 'increasing') return 'rgba(34, 197, 94, 1)';
    if (trendDirection === 'decreasing') return 'rgba(239, 68, 68, 1)';
    return 'rgba(59, 130, 246, 1)';
  };

  const chartData = {
    labels,
    datasets: [
      {
        label: metricName,
        data: values,
        borderColor: getBorderColor(),
        backgroundColor: getLineColor(),
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.1,
      },
      // Add baseline if provided
      ...(baseline
        ? [
            {
              label: 'Baseline',
              data: Array(dataPoints.length).fill(baseline.value),
              borderColor: 'rgba(156, 163, 175, 0.5)',
              backgroundColor: 'rgba(156, 163, 175, 0.3)',
              borderWidth: 2,
              borderDash: [5, 5],
              pointRadius: 0,
              tension: 0,
            },
          ]
        : []),
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const getTrendIcon = () => {
    if (trendDirection === 'increasing') return '↗';
    if (trendDirection === 'decreasing') return '↘';
    return '→';
  };

  const getTrendColor = () => {
    if (trendDirection === 'increasing') return 'text-green-600';
    if (trendDirection === 'decreasing') return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{metricName}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-2xl font-bold ${getTrendColor()}`}>
              {getTrendIcon()} {changePercentage.toFixed(1)}%
            </span>
            <span className="text-sm text-gray-500">
              {trendDirection === 'increasing' && 'increasing'}
              {trendDirection === 'decreasing' && 'decreasing'}
              {trendDirection === 'stable' && 'stable'}
            </span>
          </div>
        </div>
        {isSignificantChange && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-1 rounded-lg text-sm font-medium">
            Significant Change
          </div>
        )}
      </div>

      <div className="h-64">
        <Line data={chartData} options={options} />
      </div>

      {baseline && (
        <div className="mt-4 text-sm text-gray-600">
          <span className="font-medium">Baseline:</span> {baseline.value.toFixed(2)} (
          {new Date(baseline.date).toLocaleDateString()})
        </div>
      )}
    </div>
  );
};
