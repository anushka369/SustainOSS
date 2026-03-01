# Git Repository Ingestion Layer

This module implements the ingestion layer for SustainOSS, responsible for extracting data from Git repositories and platform APIs (GitHub/GitLab).

## Components

### RepositoryParser
Handles Git repository operations:
- Clone repositories (HTTPS and SSH)
- Extract commit history with date filtering
- Update existing repositories
- Handle authentication (tokens, SSH keys)
- Provide descriptive error messages

**Requirements**: 1.1, 1.6

### GitHubClient
Integrates with GitHub API:
- Fetch pull requests with reviewers and metadata
- Fetch issues with assignees and labels
- Handle rate limiting with exponential backoff
- Parse GitHub URLs (HTTPS and SSH)

**Requirements**: 1.3, 1.4

### GitLabClient
Integrates with GitLab API:
- Fetch merge requests with approvals
- Fetch issues with notes
- Handle rate limiting with exponential backoff
- Parse GitLab URLs (HTTPS and SSH)

**Requirements**: 1.3, 1.4

### IngestionOrchestrator
Coordinates the ingestion process:
- Add new repositories
- Sync repositories incrementally
- Store last sync timestamp per repository
- Filter data extraction to only new items since last sync
- Detect platform (GitHub/GitLab) and route accordingly

**Requirements**: 1.5

## Usage

```typescript
import { IngestionOrchestrator } from './ingestion';

const orchestrator = new IngestionOrchestrator({
  workingDirectory: '/path/to/repos',
  githubToken: 'your-github-token',
  gitlabToken: 'your-gitlab-token',
});

// Add a new repository
const result = await orchestrator.addRepository(
  'https://github.com/owner/repo',
  { token: 'optional-token' }
);

// Sync an existing repository (incremental update)
const syncResult = await orchestrator.syncRepository(result.repository.id);

console.log(`Synced ${syncResult.newCommits} commits, ${syncResult.newPRs} PRs, ${syncResult.newIssues} issues`);
```

## Features

### Incremental Updates
The orchestrator stores the last sync timestamp for each repository and only fetches data created after that timestamp. This avoids re-processing the entire history on each sync.

### Rate Limiting
Both GitHub and GitLab clients implement exponential backoff retry logic:
- Detect rate limit errors (403/429)
- Wait until rate limit resets
- Retry failed requests up to 3 times
- Handle network errors gracefully

### Error Handling
All components provide descriptive error messages:
- Invalid repository URLs
- Authentication failures
- Repository not found
- Network errors
- Permission denied

## Testing

Run tests:
```bash
npm test -- ingestion
```

Tests cover:
- URL validation
- Error handling
- URL parsing for GitHub and GitLab
- Repository cloning validation
