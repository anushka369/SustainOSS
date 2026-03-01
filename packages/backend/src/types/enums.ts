/**
 * Enums for SustainOSS data models
 */

export enum PRStatus {
  OPEN = 'open',
  MERGED = 'merged',
  CLOSED = 'closed',
}

export enum IssueStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum MaintainerRole {
  OWNER = 'owner',
  MAINTAINER = 'maintainer',
  CONTRIBUTOR = 'contributor',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum BurnoutAlertType {
  HIGH_LOAD = 'high_load',
  INCREASING_BACKLOG = 'increasing_backlog',
  DECLINING_RESPONSIVENESS = 'declining_responsiveness',
  UNTRIAGED_ISSUES = 'untriaged_issues',
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum TrendDirection {
  INCREASING = 'increasing',
  DECREASING = 'decreasing',
  STABLE = 'stable',
}
