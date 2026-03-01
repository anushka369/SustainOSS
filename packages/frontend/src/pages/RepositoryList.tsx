import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Repository {
  _id: string;
  name: string;
  url: string;
  last_sync: string;
  sustainability_score?: number;
  burnout_risk?: 'low' | 'medium' | 'high';
}

export const RepositoryList: React.FC = () => {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [syncingRepos, setSyncingRepos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    try {
      const response = await fetch('/api/v1/repositories');
      if (!response.ok) throw new Error('Failed to fetch repositories');
      const data = await response.json();
      setRepositories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repositories');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoUrl.trim()) return;

    try {
      const response = await fetch('/api/v1/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newRepoUrl }),
      });

      if (!response.ok) throw new Error('Failed to add repository');

      await fetchRepositories();
      setNewRepoUrl('');
      setShowAddForm(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add repository');
    }
  };

  const handleSync = async (repoId: string) => {
    setSyncingRepos((prev) => new Set(prev).add(repoId));
    try {
      const response = await fetch(`/api/v1/repositories/${repoId}/sync`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to sync repository');

      await fetchRepositories();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync repository');
    } finally {
      setSyncingRepos((prev) => {
        const next = new Set(prev);
        next.delete(repoId);
        return next;
      });
    }
  };

  const getRiskColor = (risk?: string) => {
    switch (risk) {
      case 'high':
        return 'text-red-600 bg-red-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-600';
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64" role="status" aria-live="polite">
        <div className="text-gray-600">Loading repositories...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Repositories</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-expanded={showAddForm}
          aria-controls="add-repository-form"
        >
          {showAddForm ? 'Cancel' : 'Add Repository'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6" role="region" aria-label="Add new repository form">
          <h3 className="text-xl font-semibold mb-4">Add New Repository</h3>
          <form onSubmit={handleAddRepository}>
            <div className="mb-4">
              <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Repository URL
              </label>
              <input
                type="text"
                id="repoUrl"
                value={newRepoUrl}
                onChange={(e) => setNewRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repository"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-required="true"
                required
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Add Repository
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {repositories.length === 0 ? (
          <div className="p-6 text-center text-gray-600" role="status">
            No repositories added yet. Click "Add Repository" to get started.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200" role="table" aria-label="Repository list">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sustainability Score
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Burnout Risk
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {repositories.map((repo) => (
                <tr key={repo._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{repo.name}</div>
                    <div className="text-sm text-gray-500">{repo.url}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-2xl font-bold ${getScoreColor(repo.sustainability_score)}`} aria-label={`Sustainability score: ${repo.sustainability_score?.toFixed(1) ?? 'Not available'}`}>
                      {repo.sustainability_score?.toFixed(1) ?? 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRiskColor(
                        repo.burnout_risk
                      )}`}
                      role="status"
                      aria-label={`Burnout risk: ${repo.burnout_risk ?? 'Unknown'}`}
                    >
                      {repo.burnout_risk ?? 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {repo.last_sync ? new Date(repo.last_sync).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => navigate(`/dashboard?repo=${repo._id}`)}
                      className="text-blue-600 hover:text-blue-900 mr-4 focus:outline-none focus:underline"
                      aria-label={`View dashboard for ${repo.name}`}
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleSync(repo._id)}
                      disabled={syncingRepos.has(repo._id)}
                      className="text-blue-600 hover:text-blue-900 disabled:text-gray-400 disabled:cursor-not-allowed focus:outline-none focus:underline"
                      aria-label={`Sync ${repo.name}`}
                      aria-busy={syncingRepos.has(repo._id)}
                    >
                      {syncingRepos.has(repo._id) ? 'Syncing...' : 'Sync'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
