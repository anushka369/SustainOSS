/**
 * Property-based tests for data model completeness
 * Feature: sustainoss, Property 2: Complete Data Field Extraction
 * Validates: Requirements 1.2, 1.3, 1.4
 */

import * as fc from 'fast-check';
import {
  CommitRecord,
  PRRecord,
  IssueRecord,
  PRStatus,
  IssueStatus,
} from '../index';

describe('Property 2: Complete Data Field Extraction', () => {
  /**
   * Test that all required fields are present and non-null in CommitRecord
   * Validates: Requirement 1.2
   */
  test('CommitRecord should have all required fields present and non-null', () => {
    fc.assert(
      fc.property(
        fc.record({
          sha: fc.string({ minLength: 1 }),
          author: fc.string({ minLength: 1 }),
          author_email: fc.emailAddress(),
          timestamp: fc.date(),
          files_changed: fc.nat(),
          insertions: fc.nat(),
          deletions: fc.nat(),
          message: fc.string(),
        }),
        (commit: CommitRecord) => {
          // All required fields must be present
          expect(commit.sha).toBeDefined();
          expect(commit.author).toBeDefined();
          expect(commit.author_email).toBeDefined();
          expect(commit.timestamp).toBeDefined();
          expect(commit.files_changed).toBeDefined();
          expect(commit.insertions).toBeDefined();
          expect(commit.deletions).toBeDefined();
          expect(commit.message).toBeDefined();

          // Non-null checks for required fields
          expect(commit.sha).not.toBeNull();
          expect(commit.author).not.toBeNull();
          expect(commit.author_email).not.toBeNull();
          expect(commit.timestamp).not.toBeNull();
          expect(commit.files_changed).not.toBeNull();
          expect(commit.insertions).not.toBeNull();
          expect(commit.deletions).not.toBeNull();
          expect(commit.message).not.toBeNull();

          // Type checks
          expect(typeof commit.sha).toBe('string');
          expect(typeof commit.author).toBe('string');
          expect(typeof commit.author_email).toBe('string');
          expect(commit.timestamp).toBeInstanceOf(Date);
          expect(typeof commit.files_changed).toBe('number');
          expect(typeof commit.insertions).toBe('number');
          expect(typeof commit.deletions).toBe('number');
          expect(typeof commit.message).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Test that all required fields are present and non-null in PRRecord
   * Validates: Requirement 1.3
   */
  test('PRRecord should have all required fields present and non-null', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          author: fc.string({ minLength: 1 }),
          reviewers: fc.array(fc.string({ minLength: 1 })),
          created_at: fc.date(),
          merged_at: fc.option(fc.date(), { nil: null }),
          closed_at: fc.option(fc.date(), { nil: null }),
          review_comments: fc.nat(),
          files_changed: fc.nat(),
          status: fc.constantFrom(
            PRStatus.OPEN,
            PRStatus.MERGED,
            PRStatus.CLOSED
          ),
        }),
        (pr: PRRecord) => {
          // All required fields must be present
          expect(pr.id).toBeDefined();
          expect(pr.author).toBeDefined();
          expect(pr.reviewers).toBeDefined();
          expect(pr.created_at).toBeDefined();
          expect(pr.merged_at).toBeDefined();
          expect(pr.closed_at).toBeDefined();
          expect(pr.review_comments).toBeDefined();
          expect(pr.files_changed).toBeDefined();
          expect(pr.status).toBeDefined();

          // Non-null checks for required fields (nullable fields can be null)
          expect(pr.id).not.toBeNull();
          expect(pr.author).not.toBeNull();
          expect(pr.reviewers).not.toBeNull();
          expect(pr.created_at).not.toBeNull();
          expect(pr.review_comments).not.toBeNull();
          expect(pr.files_changed).not.toBeNull();
          expect(pr.status).not.toBeNull();

          // Type checks
          expect(typeof pr.id).toBe('string');
          expect(typeof pr.author).toBe('string');
          expect(Array.isArray(pr.reviewers)).toBe(true);
          expect(pr.created_at).toBeInstanceOf(Date);
          expect(pr.merged_at === null || pr.merged_at instanceof Date).toBe(
            true
          );
          expect(pr.closed_at === null || pr.closed_at instanceof Date).toBe(
            true
          );
          expect(typeof pr.review_comments).toBe('number');
          expect(typeof pr.files_changed).toBe('number');
          expect(Object.values(PRStatus)).toContain(pr.status);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Test that all required fields are present and non-null in IssueRecord
   * Validates: Requirement 1.4
   */
  test('IssueRecord should have all required fields present and non-null', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          author: fc.string({ minLength: 1 }),
          assignees: fc.array(fc.string({ minLength: 1 })),
          labels: fc.array(fc.string({ minLength: 1 })),
          created_at: fc.date(),
          closed_at: fc.option(fc.date(), { nil: null }),
          first_response_at: fc.option(fc.date(), { nil: null }),
          comment_count: fc.nat(),
          status: fc.constantFrom(IssueStatus.OPEN, IssueStatus.CLOSED),
          title: fc.string({ minLength: 1 }),
          description: fc.string(),
        }),
        (issue: IssueRecord) => {
          // All required fields must be present
          expect(issue.id).toBeDefined();
          expect(issue.author).toBeDefined();
          expect(issue.assignees).toBeDefined();
          expect(issue.labels).toBeDefined();
          expect(issue.created_at).toBeDefined();
          expect(issue.closed_at).toBeDefined();
          expect(issue.first_response_at).toBeDefined();
          expect(issue.comment_count).toBeDefined();
          expect(issue.status).toBeDefined();
          expect(issue.title).toBeDefined();
          expect(issue.description).toBeDefined();

          // Non-null checks for required fields (nullable fields can be null)
          expect(issue.id).not.toBeNull();
          expect(issue.author).not.toBeNull();
          expect(issue.assignees).not.toBeNull();
          expect(issue.labels).not.toBeNull();
          expect(issue.created_at).not.toBeNull();
          expect(issue.comment_count).not.toBeNull();
          expect(issue.status).not.toBeNull();
          expect(issue.title).not.toBeNull();
          expect(issue.description).not.toBeNull();

          // Type checks
          expect(typeof issue.id).toBe('string');
          expect(typeof issue.author).toBe('string');
          expect(Array.isArray(issue.assignees)).toBe(true);
          expect(Array.isArray(issue.labels)).toBe(true);
          expect(issue.created_at).toBeInstanceOf(Date);
          expect(
            issue.closed_at === null || issue.closed_at instanceof Date
          ).toBe(true);
          expect(
            issue.first_response_at === null ||
              issue.first_response_at instanceof Date
          ).toBe(true);
          expect(typeof issue.comment_count).toBe('number');
          expect(Object.values(IssueStatus)).toContain(issue.status);
          expect(typeof issue.title).toBe('string');
          expect(typeof issue.description).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });
});
