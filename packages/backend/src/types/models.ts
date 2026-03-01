/**
 * Core data models for SustainOSS
 * Based on design document specifications
 */

import {
  PRStatus,
  IssueStatus,
  MaintainerRole,
  BurnoutAlertType,
  AlertSeverity,
  TrendDirection,
} from './enums';

/**
 * Represents authentication credentials for repository access
 */
export interface Credentials {
  token?: string;
  username?: string;
  password?: string;
  sshKeyPath?: string;
}

/**
 * Represents a Git repository
 * Requirements: 1.1
 */
export interface Repository {
  id: string;
  url: string;
  name: string;
  localPath: string;
  credentials?: Credentials;
  lastSync: Date;
  createdAt: Date;
  maintainers: Maintainer[];
}

/**
 * Represents a Git commit (simplified version of CommitRecord for internal use)
 */
export interface Commit {
  sha: string;
  author: string;
  authorEmail: string;
  timestamp: Date;
  filesChanged: number;
  insertions: number;
  deletions: number;
  message: string;
}

/**
 * Represents a Git commit record
 * Requirements: 1.2
 */
export interface CommitRecord {
  sha: string;
  author: string;
  author_email: string;
  timestamp: Date;
  files_changed: number;
  insertions: number;
  deletions: number;
  message: string;
}

/**
 * Represents a Pull Request record
 * Requirements: 1.3
 */
export interface PRRecord {
  id: string;
  author: string;
  reviewers: string[];
  created_at: Date;
  merged_at: Date | null;
  closed_at: Date | null;
  review_comments: number;
  files_changed: number;
  status: PRStatus;
}

/**
 * Represents an Issue record
 * Requirements: 1.4
 */
export interface IssueRecord {
  id: string;
  author: string;
  assignees: string[];
  labels: string[];
  created_at: Date;
  closed_at: Date | null;
  first_response_at: Date | null;
  comment_count: number;
  status: IssueStatus;
  title: string;
  description: string;
}

/**
 * Represents a repository maintainer
 * Requirements: 1.2
 */
export interface Maintainer {
  name: string;
  email: string;
  role: MaintainerRole;
}

/**
 * Represents a burnout alert
 * Requirements: 3.5
 */
export interface BurnoutAlert {
  type: BurnoutAlertType;
  severity: AlertSeverity;
  affected_maintainers: string[];
  metric_value: number;
  threshold: number;
  message: string;
  timestamp: Date;
}

/**
 * Represents a sustainability score with component breakdowns
 * Requirements: 5.5
 */
export interface SustainabilityScore {
  overall_score: number; // 0-100
  contributor_diversity_score: number; // 0-25
  load_distribution_score: number; // 0-25
  response_time_score: number; // 0-25
  retention_score: number; // 0-25
  missing_metrics: string[];
  timestamp: Date;
}

/**
 * Represents a single data point in a trend
 */
export interface DataPoint {
  timestamp: Date;
  value: number;
}

/**
 * Represents trend data for a metric over time
 * Requirements: 6.1, 6.2
 */
export interface TrendData {
  metric_name: string;
  data_points: DataPoint[];
  trend_direction: TrendDirection;
  change_percentage: number;
}

/**
 * Represents a trend alert for significant changes
 */
export interface TrendAlert {
  metric_name: string;
  change_percentage: number;
  direction: 'increase' | 'decrease';
  current_value: number;
  previous_value: number;
  is_significant: boolean; // > 30% change
}

/**
 * Represents complexity scoring for an issue
 */
export interface ComplexityScore {
  score: number; // 0-100
  factors: Record<string, number>;
}

/**
 * Represents clarity scoring for an issue
 */
export interface ClarityScore {
  score: number; // 0-100
  factors: Record<string, number>;
}

/**
 * Represents a good first issue recommendation
 */
export interface IssueRecommendation {
  issue_id: string;
  title: string;
  complexity_score: number; // 0-100
  clarity_score: number; // 0-100
  overall_score: number; // 0-100
  justification: string;
  labels: string[];
}
