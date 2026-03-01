import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

interface IssueRecommendation {
  issue_id: string;
  title: string;
  complexity_score: number;
  clarity_score: number;
  overall_score: number;
  justification: string;
  labels: string[];
}

interface GoodFirstIssuesResponse {
  repository_id: string;
  recommendations: IssueRecommendation[];
  total: number;
}

export const GoodFirstIssues: React.FC = () => {
  const [searchParams] = useSearchParams();
  const repoId = searchParams.get('repo');
  const [recommendations, setRecommendations] = useState<IssueRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    if (!repoId) {
      setError('No repository selected');
      setLoading(false);
      return;
    }
    fetchRecommendations();
  }, [repoId, limit]);

  const fetchRecommendations = async () => {
    if (!repoId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/repositories/${repoId}/good-first-issues?limit=${limit}`
      );
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      const data: GoodFirstIssuesResponse = await response.json();

      setRecommendations(data.recommendations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 70) return 'bg-blue-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-gray-100';
  };

  if (!repoId) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Please select a repository from the list</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading recommendations...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Good First Issues</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="limit" className="text-sm font-medium text-gray-700">
            Show:
          </label>
          <select
            id="limit"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={5}>5 issues</option>
            <option value={10}>10 issues</option>
            <option value={20}>20 issues</option>
            <option value={50}>50 issues</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {recommendations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-center">
            No good first issue recommendations found for this repository.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Complexity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Clarity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overall Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Justification
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Labels
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recommendations.map((rec) => (
                  <tr key={rec.issue_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <a
                        href={`https://github.com/repo/issues/${rec.issue_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        {rec.title}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span
                          className={`px-2 py-1 text-sm font-semibold rounded ${getScoreBgColor(
                            100 - rec.complexity_score
                          )} ${getScoreColor(100 - rec.complexity_score)}`}
                        >
                          {rec.complexity_score.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span
                          className={`px-2 py-1 text-sm font-semibold rounded ${getScoreBgColor(
                            rec.clarity_score
                          )} ${getScoreColor(rec.clarity_score)}`}
                        >
                          {rec.clarity_score.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span
                          className={`px-2 py-1 text-sm font-semibold rounded ${getScoreBgColor(
                            rec.overall_score
                          )} ${getScoreColor(rec.overall_score)}`}
                        >
                          {rec.overall_score.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700 max-w-md">{rec.justification}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {rec.labels.length > 0 ? (
                          rec.labels.map((label, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded"
                            >
                              {label}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">No labels</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          Showing {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};
