import { Pool } from 'pg';
import { IssueStore } from '../storage/index.js';
import {
  IssueRecord,
  ComplexityScore,
  ClarityScore,
  IssueRecommendation,
} from '../types/models.js';
import { IssueStatus } from '../types/enums.js';

/**
 * Repository history data for complexity analysis
 */
export interface RepositoryHistory {
  closedIssues: IssueRecord[];
}

/**
 * Good First Issue Analyzer for identifying issues suitable for new contributors
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
export class GoodFirstIssueAnalyzer {
  private issueStore: IssueStore;

  constructor(pool: Pool) {
    this.issueStore = new IssueStore(pool);
  }

  /**
   * Analyze issue complexity based on repository history
   * Requirements: 7.1
   * 
   * Complexity Score (lower is better):
   * - Base score: 50
   * - Subtract 10 for each similar closed issue (indicates common pattern)
   * - Add 5 for each file typically modified in similar issues
   * - Add 10 if avg lines changed in similar issues > 100
   * - Clamp to 0-100
   */
  analyzeIssueComplexity(
    issue: IssueRecord,
    repoHistory: RepositoryHistory
  ): ComplexityScore {
    let score = 50;
    const factors: Record<string, number> = {};

    // Find similar closed issues based on labels
    const similarIssues = repoHistory.closedIssues.filter((closedIssue) => {
      // Check if any labels match
      return issue.labels.some((label) =>
        closedIssue.labels.includes(label)
      );
    });

    // Subtract 10 for each similar closed issue (max 5 issues)
    const similarCount = Math.min(similarIssues.length, 5);
    const similarBonus = similarCount * 10;
    score -= similarBonus;
    factors.similar_closed_issues = -similarBonus;

    // For simplicity, we estimate file count and lines changed based on issue characteristics
    // In a real implementation, this would analyze actual PR data linked to similar issues
    
    // Estimate file count based on labels (e.g., "documentation" = fewer files)
    const hasDocLabel = issue.labels.some((label) =>
      label.toLowerCase().includes('doc')
    );
    const hasBugLabel = issue.labels.some((label) =>
      label.toLowerCase().includes('bug')
    );
    
    let estimatedFileCount = 3; // default
    if (hasDocLabel) {
      estimatedFileCount = 1;
    } else if (hasBugLabel) {
      estimatedFileCount = 2;
    }

    const fileCountPenalty = estimatedFileCount * 5;
    score += fileCountPenalty;
    factors.estimated_file_count = fileCountPenalty;

    // Estimate lines changed based on description length and complexity indicators
    const hasComplexityIndicators = issue.description.toLowerCase().includes('refactor') ||
      issue.description.toLowerCase().includes('architecture') ||
      issue.description.toLowerCase().includes('redesign');
    
    if (hasComplexityIndicators) {
      score += 10;
      factors.high_complexity_indicators = 10;
    }

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    return { score, factors };
  }

  /**
   * Analyze issue clarity based on description quality
   * Requirements: 7.2
   * 
   * Clarity Score (higher is better):
   * - Base score: 50
   * - Add 20 if description > 200 characters
   * - Add 15 if contains code blocks or reproduction steps
   * - Add 15 if has labels
   * - Clamp to 0-100
   */
  analyzeIssueClarity(issue: IssueRecord): ClarityScore {
    let score = 50;
    const factors: Record<string, number> = {};

    // Check description length
    if (issue.description.length > 200) {
      score += 20;
      factors.long_description = 20;
    }

    // Check for code blocks (markdown code blocks with ``` or `)
    const hasCodeBlocks = issue.description.includes('```') || 
      issue.description.includes('`');
    
    // Check for reproduction steps
    const hasReproductionSteps = 
      issue.description.toLowerCase().includes('reproduce') ||
      issue.description.toLowerCase().includes('steps to') ||
      issue.description.toLowerCase().includes('how to');

    if (hasCodeBlocks || hasReproductionSteps) {
      score += 15;
      factors.code_or_reproduction = 15;
    }

    // Check for labels
    if (issue.labels.length > 0) {
      score += 15;
      factors.has_labels = 15;
    }

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    return { score, factors };
  }

  /**
   * Recommend good first issues based on complexity and clarity scores
   * Requirements: 7.3, 7.4, 7.5
   * 
   * Overall Score = (100 - complexity_score) × 0.5 + clarity_score × 0.5
   * Recommend issues with overall_score > 60
   * Sort by overall_score descending
   */
  async recommendGoodFirstIssues(
    repoId: string,
    limit: number = 10
  ): Promise<IssueRecommendation[]> {
    // Get all open issues
    const openIssues = await this.issueStore.findByStatus(
      repoId,
      IssueStatus.OPEN
    );

    // Get closed issues for history analysis
    const closedIssues = await this.issueStore.findByStatus(
      repoId,
      IssueStatus.CLOSED
    );

    const repoHistory: RepositoryHistory = { closedIssues };

    // Analyze each open issue
    const recommendations: IssueRecommendation[] = [];

    for (const issue of openIssues) {
      const complexityScore = this.analyzeIssueComplexity(issue, repoHistory);
      const clarityScore = this.analyzeIssueClarity(issue);

      // Calculate overall score
      const overallScore =
        (100 - complexityScore.score) * 0.5 + clarityScore.score * 0.5;

      // Only recommend if overall score > 60
      if (overallScore > 60) {
        const justification = this.generateJustification(
          complexityScore,
          clarityScore,
          overallScore
        );

        recommendations.push({
          issue_id: issue.id,
          title: issue.title,
          complexity_score: complexityScore.score,
          clarity_score: clarityScore.score,
          overall_score: overallScore,
          justification,
          labels: issue.labels,
        });
      }
    }

    // Sort by overall score descending
    recommendations.sort((a, b) => b.overall_score - a.overall_score);

    // Return top N recommendations
    return recommendations.slice(0, limit);
  }

  /**
   * Generate justification string for a recommendation
   */
  private generateJustification(
    complexityScore: ComplexityScore,
    clarityScore: ClarityScore,
    overallScore: number
  ): string {
    const parts: string[] = [];

    // Complexity justification
    if (complexityScore.score < 40) {
      parts.push('Low complexity');
    } else if (complexityScore.score < 60) {
      parts.push('Moderate complexity');
    }

    // Clarity justification
    if (clarityScore.score > 80) {
      parts.push('very clear description');
    } else if (clarityScore.score > 60) {
      parts.push('clear description');
    }

    // Specific factors
    if (complexityScore.factors.similar_closed_issues < 0) {
      const count = Math.abs(complexityScore.factors.similar_closed_issues) / 10;
      parts.push(`${count} similar resolved issue(s)`);
    }

    if (clarityScore.factors.code_or_reproduction) {
      parts.push('includes code examples or reproduction steps');
    }

    if (clarityScore.factors.has_labels) {
      parts.push('properly labeled');
    }

    const justification = parts.length > 0
      ? parts.join(', ') + `. Overall score: ${overallScore.toFixed(1)}/100`
      : `Overall score: ${overallScore.toFixed(1)}/100`;

    return justification;
  }
}
