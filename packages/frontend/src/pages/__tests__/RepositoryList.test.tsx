import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { RepositoryList } from '../RepositoryList';

// Mock fetch
global.fetch = jest.fn();

// Helper to render with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('RepositoryList', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  describe('Table rendering with various data', () => {
    it('should display loading state initially', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithRouter(<RepositoryList />);
      expect(screen.getByText('Loading repositories...')).toBeInTheDocument();
    });

    it('should render empty state when no repositories exist', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      renderWithRouter(<RepositoryList />);

      await waitFor(() => {
        expect(screen.getByText(/No repositories added yet/i)).toBeInTheDocument();
      });
    });

    it('should render table with repository data', async () => {
      const mockRepos = [
        {
          _id: '1',
          name: 'test-repo',
          url: 'https://github.com/test/repo',
          last_sync: '2024-01-15T10:00:00Z',
          sustainability_score: 75.5,
          burnout_risk: 'low',
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos,
      });

      renderWithRouter(<RepositoryList />);

      await waitFor(() => {
        expect(screen.getByText('test-repo')).toBeInTheDocument();
        expect(screen.getByText('https://github.com/test/repo')).toBeInTheDocument();
        expect(screen.getByText('75.5')).toBeInTheDocument();
        expect(screen.getByText('low')).toBeInTheDocument();
      });
    });

    it('should render multiple repositories', async () => {
      const mockRepos = [
        {
          _id: '1',
          name: 'repo-1',
          url: 'https://github.com/test/repo1',
          last_sync: '2024-01-15T10:00:00Z',
          sustainability_score: 80,
          burnout_risk: 'low',
        },
        {
          _id: '2',
          name: 'repo-2',
          url: 'https://github.com/test/repo2',
          last_sync: '2024-01-16T10:00:00Z',
          sustainability_score: 45,
          burnout_risk: 'high',
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos,
      });

      renderWithRouter(<RepositoryList />);

      await waitFor(() => {
        expect(screen.getByText('repo-1')).toBeInTheDocument();
        expect(screen.getByText('repo-2')).toBeInTheDocument();
      });
    });

    it('should display correct color coding for burnout risk levels', async () => {
      const mockRepos = [
        {
          _id: '1',
          name: 'low-risk',
          url: 'https://github.com/test/low',
          last_sync: '2024-01-15T10:00:00Z',
          burnout_risk: 'low',
        },
        {
          _id: '2',
          name: 'medium-risk',
          url: 'https://github.com/test/medium',
          last_sync: '2024-01-15T10:00:00Z',
          burnout_risk: 'medium',
        },
        {
          _id: '3',
          name: 'high-risk',
          url: 'https://github.com/test/high',
          last_sync: '2024-01-15T10:00:00Z',
          burnout_risk: 'high',
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos,
      });

      renderWithRouter(<RepositoryList />);

      await waitFor(() => {
        const lowRisk = screen.getByText('low');
        const mediumRisk = screen.getByText('medium');
        const highRisk = screen.getByText('high');

        expect(lowRisk).toHaveClass('text-green-600');
        expect(mediumRisk).toHaveClass('text-yellow-600');
        expect(highRisk).toHaveClass('text-red-600');
      });
    });

    it('should display correct color coding for sustainability scores', async () => {
      const mockRepos = [
        {
          _id: '1',
          name: 'high-score',
          url: 'https://github.com/test/high',
          last_sync: '2024-01-15T10:00:00Z',
          sustainability_score: 85,
        },
        {
          _id: '2',
          name: 'medium-score',
          url: 'https://github.com/test/medium',
          last_sync: '2024-01-15T10:00:00Z',
          sustainability_score: 60,
        },
        {
          _id: '3',
          name: 'low-score',
          url: 'https://github.com/test/low',
          last_sync: '2024-01-15T10:00:00Z',
          sustainability_score: 30,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos,
      });

      renderWithRouter(<RepositoryList />);

      await waitFor(() => {
        const scores = screen.getAllByText(/\d+\.\d/);
        expect(scores[0]).toHaveClass('text-green-600'); // 85
        expect(scores[1]).toHaveClass('text-yellow-600'); // 60
        expect(scores[2]).toHaveClass('text-red-600'); // 30
      });
    });

    it('should handle missing optional fields gracefully', async () => {
      const mockRepos = [
        {
          _id: '1',
          name: 'incomplete-repo',
          url: 'https://github.com/test/incomplete',
          last_sync: null,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos,
      });

      renderWithRouter(<RepositoryList />);

      await waitFor(() => {
        expect(screen.getByText('incomplete-repo')).toBeInTheDocument();
        expect(screen.getByText('N/A')).toBeInTheDocument(); // sustainability score
        expect(screen.getByText('Unknown')).toBeInTheDocument(); // burnout risk
        expect(screen.getByText('Never')).toBeInTheDocument(); // last sync
      });
    });
  });

  describe('Add repository form validation', () => {
    it('should show add repository form when button is clicked', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      renderWithRouter(<RepositoryList />);

      await waitFor(() => {
        expect(screen.getByText('Add Repository')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Add Repository'));

      expect(screen.getByText('Add New Repository')).toBeInTheDocument();
      expect(screen.getByLabelText('Repository URL')).toBeInTheDocument();
    });

    it('should hide form when cancel is clicked', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      renderWithRouter(<RepositoryList />);

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Repository'));
      });

      expect(screen.getByText('Add New Repository')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByText('Add New Repository')).not.toBeInTheDocument();
    });

    it('should require URL input', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      renderWithRouter(<RepositoryList />);

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Repository'));
      });

      const input = screen.getByLabelText('Repository URL') as HTMLInputElement;
      expect(input.required).toBe(true);
    });

    it('should submit form with valid URL', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ _id: '1', name: 'new-repo', url: 'https://github.com/test/new' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ _id: '1', name: 'new-repo', url: 'https://github.com/test/new' }],
        });

      renderWithRouter(<RepositoryList />);

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Repository'));
      });

      const input = screen.getByLabelText('Repository URL');
      fireEvent.change(input, { target: { value: 'https://github.com/test/new' } });

      const buttons = screen.getAllByRole('button', { name: /Add Repository/i });
      const submitButton = buttons[buttons.length - 1];
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/repositories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://github.com/test/new' }),
        });
      });
    });
  });
});
