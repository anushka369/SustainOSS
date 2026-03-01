-- SustainOSS Database Schema
-- Requirements: 1.1, 1.2, 1.3, 1.4

-- Enable TimescaleDB extension for time series data
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Repositories table
CREATE TABLE IF NOT EXISTS repositories (
    id VARCHAR(255) PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    local_path TEXT NOT NULL,
    credentials_encrypted TEXT,
    last_sync TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    maintainers JSONB DEFAULT '[]'::jsonb
);

-- Commits table
CREATE TABLE IF NOT EXISTS commits (
    id SERIAL PRIMARY KEY,
    repo_id VARCHAR(255) NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    sha VARCHAR(40) NOT NULL,
    author VARCHAR(255) NOT NULL,
    author_email VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    files_changed INTEGER NOT NULL DEFAULT 0,
    insertions INTEGER NOT NULL DEFAULT 0,
    deletions INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    UNIQUE(repo_id, sha)
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_commits_repo_timestamp ON commits(repo_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_commits_author_email ON commits(author_email);

-- Pull Requests table
CREATE TABLE IF NOT EXISTS pull_requests (
    id SERIAL PRIMARY KEY,
    repo_id VARCHAR(255) NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    pr_id VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    reviewers JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL,
    merged_at TIMESTAMP,
    closed_at TIMESTAMP,
    review_comments INTEGER NOT NULL DEFAULT 0,
    files_changed INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    UNIQUE(repo_id, pr_id)
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_prs_repo_created ON pull_requests(repo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prs_status ON pull_requests(status);
CREATE INDEX IF NOT EXISTS idx_prs_author ON pull_requests(author);

-- Issues table
CREATE TABLE IF NOT EXISTS issues (
    id SERIAL PRIMARY KEY,
    repo_id VARCHAR(255) NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    issue_id VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    assignees JSONB DEFAULT '[]'::jsonb,
    labels JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL,
    closed_at TIMESTAMP,
    first_response_at TIMESTAMP,
    comment_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    UNIQUE(repo_id, issue_id)
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_issues_repo_created ON issues(repo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_author ON issues(author);

-- Burnout Alerts table
CREATE TABLE IF NOT EXISTS burnout_alerts (
    id SERIAL PRIMARY KEY,
    repo_id VARCHAR(255) NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    affected_maintainers JSONB DEFAULT '[]'::jsonb,
    metric_value FLOAT NOT NULL,
    threshold FLOAT NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_alerts_repo_timestamp ON burnout_alerts(repo_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON burnout_alerts(resolved);

-- Repository Metrics table (TimescaleDB hypertable for time series data)
CREATE TABLE IF NOT EXISTS repository_metrics (
    time TIMESTAMP NOT NULL,
    repo_id VARCHAR(255) NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    maintainer VARCHAR(255),
    value DOUBLE PRECISION NOT NULL
);

-- Convert to hypertable for time series optimization
SELECT create_hypertable('repository_metrics', 'time', if_not_exists => TRUE);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_metrics_repo_metric ON repository_metrics(repo_id, metric_name, time DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_maintainer ON repository_metrics(maintainer, time DESC) WHERE maintainer IS NOT NULL;
