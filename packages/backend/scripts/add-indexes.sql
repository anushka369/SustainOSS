-- Performance optimization indexes for SustainOSS
-- Add indexes for common query patterns

-- Repositories table indexes
CREATE INDEX IF NOT EXISTS idx_repositories_url ON repositories(url);
CREATE INDEX IF NOT EXISTS idx_repositories_created_at ON repositories(created_at DESC);

-- Commits table indexes
CREATE INDEX IF NOT EXISTS idx_commits_repo_id ON commits(repo_id);
CREATE INDEX IF NOT EXISTS idx_commits_timestamp ON commits(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_commits_author ON commits(author);
CREATE INDEX IF NOT EXISTS idx_commits_repo_timestamp ON commits(repo_id, timestamp DESC);

-- Pull requests table indexes
CREATE INDEX IF NOT EXISTS idx_pull_requests_repo_id ON pull_requests(repo_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_status ON pull_requests(status);
CREATE INDEX IF NOT EXISTS idx_pull_requests_created_at ON pull_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pull_requests_repo_status ON pull_requests(repo_id, status);
CREATE INDEX IF NOT EXISTS idx_pull_requests_author ON pull_requests(author);

-- Issues table indexes
CREATE INDEX IF NOT EXISTS idx_issues_repo_id ON issues(repo_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_repo_status ON issues(repo_id, status);
CREATE INDEX IF NOT EXISTS idx_issues_assignees ON issues USING GIN(assignees);
CREATE INDEX IF NOT EXISTS idx_issues_labels ON issues USING GIN(labels);

-- Burnout alerts table indexes
CREATE INDEX IF NOT EXISTS idx_burnout_alerts_repo_id ON burnout_alerts(repo_id);
CREATE INDEX IF NOT EXISTS idx_burnout_alerts_resolved ON burnout_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_burnout_alerts_repo_resolved ON burnout_alerts(repo_id, resolved);
CREATE INDEX IF NOT EXISTS idx_burnout_alerts_timestamp ON burnout_alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_burnout_alerts_type ON burnout_alerts(type);

-- Repository metrics table indexes (TimescaleDB hypertable)
-- Note: TimescaleDB automatically creates indexes on time column
CREATE INDEX IF NOT EXISTS idx_repository_metrics_repo_id ON repository_metrics(repo_id);
CREATE INDEX IF NOT EXISTS idx_repository_metrics_metric_name ON repository_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_repository_metrics_maintainer ON repository_metrics(maintainer) WHERE maintainer IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_repository_metrics_repo_metric ON repository_metrics(repo_id, metric_name, time DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_commits_repo_author_time ON commits(repo_id, author, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pull_requests_repo_author_time ON pull_requests(repo_id, author, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_repo_assignee_status ON issues(repo_id, status) WHERE assignees IS NOT NULL;

-- Analyze tables to update statistics
ANALYZE repositories;
ANALYZE commits;
ANALYZE pull_requests;
ANALYZE issues;
ANALYZE burnout_alerts;
ANALYZE repository_metrics;
