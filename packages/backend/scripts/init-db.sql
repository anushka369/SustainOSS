-- SustainOSS Database Initialization Script
-- This script sets up the PostgreSQL database with TimescaleDB extension

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create repositories table
CREATE TABLE IF NOT EXISTS repositories (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create commits table
CREATE TABLE IF NOT EXISTS commits (
    id SERIAL PRIMARY KEY,
    repo_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
    sha TEXT NOT NULL,
    author TEXT NOT NULL,
    author_email TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    files_changed INTEGER DEFAULT 0,
    insertions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    message TEXT,
    UNIQUE(repo_id, sha)
);

-- Create pull_requests table
CREATE TABLE IF NOT EXISTS pull_requests (
    id SERIAL PRIMARY KEY,
    repo_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
    pr_id TEXT NOT NULL,
    author TEXT NOT NULL,
    reviewers TEXT[],
    created_at TIMESTAMP NOT NULL,
    merged_at TIMESTAMP,
    closed_at TIMESTAMP,
    review_comments INTEGER DEFAULT 0,
    files_changed INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    UNIQUE(repo_id, pr_id)
);

-- Create issues table
CREATE TABLE IF NOT EXISTS issues (
    id SERIAL PRIMARY KEY,
    repo_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
    issue_id TEXT NOT NULL,
    author TEXT NOT NULL,
    assignees TEXT[],
    labels TEXT[],
    created_at TIMESTAMP NOT NULL,
    closed_at TIMESTAMP,
    first_response_at TIMESTAMP,
    comment_count INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    title TEXT,
    description TEXT,
    UNIQUE(repo_id, issue_id)
);

-- Create burnout_alerts table
CREATE TABLE IF NOT EXISTS burnout_alerts (
    id SERIAL PRIMARY KEY,
    repo_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    affected_maintainers TEXT[],
    metric_value DOUBLE PRECISION,
    threshold DOUBLE PRECISION,
    message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE
);

-- Create repository_metrics table (TimescaleDB hypertable)
CREATE TABLE IF NOT EXISTS repository_metrics (
    time TIMESTAMP NOT NULL,
    repo_id INTEGER NOT NULL,
    metric_name TEXT NOT NULL,
    maintainer TEXT,
    value DOUBLE PRECISION NOT NULL
);

-- Convert repository_metrics to hypertable
SELECT create_hypertable('repository_metrics', 'time', if_not_exists => TRUE);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_commits_repo_timestamp ON commits(repo_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_commits_author ON commits(author);
CREATE INDEX IF NOT EXISTS idx_prs_repo_created ON pull_requests(repo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prs_status ON pull_requests(status);
CREATE INDEX IF NOT EXISTS idx_issues_repo_created ON issues(repo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_burnout_alerts_repo ON burnout_alerts(repo_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_repo_metric ON repository_metrics(repo_id, metric_name, time DESC);

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sustainoss_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sustainoss_user;
