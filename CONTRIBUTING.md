# Contributing to SustainOSS

Thank you for your interest in contributing to SustainOSS! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with:
- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Your environment (OS, Node version, Docker version)
- Screenshots or logs if applicable

### Suggesting Features

Feature suggestions are welcome! Please create an issue with:
- A clear description of the feature
- The problem it solves
- Potential implementation approach
- Any relevant examples or mockups

### Submitting Pull Requests

1. **Fork the repository** and create a new branch from `main`
2. **Make your changes** following the coding standards below
3. **Write tests** for new functionality
4. **Run the test suite** to ensure all tests pass
5. **Update documentation** if needed
6. **Submit a pull request** with a clear description of changes

## Development Setup

### Prerequisites

- Node.js 20 or later
- PostgreSQL 16 or later with TimescaleDB extension
- Redis 7 or later
- Git

### Local Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/anushka369/sustainoss.git
   cd sustainoss
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp packages/backend/.env.example packages/backend/.env
   ```
   Edit `.env` with your local configuration.

4. Set up the database:
   ```bash
   npm run setup:db --workspace=@sustainoss/backend
   ```

5. Start development servers:
   ```bash
   npm run dev
   ```

   This starts:
   - Backend API on http://localhost:3000
   - Frontend dashboard on http://localhost:5173

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific package
npm test --workspace=@sustainoss/backend
npm test --workspace=@sustainoss/frontend

# Run tests in watch mode
npm run test:watch --workspace=@sustainoss/backend
```

### Running Linters

```bash
# Lint all packages
npm run lint

# Format code
npm run format
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Provide type annotations for function parameters and return values
- Avoid `any` types when possible

### Code Style

- Follow the existing code style
- Use meaningful variable and function names
- Keep functions small and focused
- Add comments for complex logic
- Use ESLint and Prettier (configured in the project)

### Testing

- Write unit tests for new functions and classes
- Write property-based tests for core algorithms
- Aim for >80% code coverage
- Test edge cases and error conditions
- Use descriptive test names

### Commits

- Write clear, concise commit messages
- Use present tense ("Add feature" not "Added feature")
- Reference issue numbers when applicable
- Keep commits focused on a single change

Example commit message:
```
Add burnout detection for high load concentration

Implements detection algorithm that flags maintainers handling
>60% of repository activity as high burnout risk.

Fixes #123
```

## Project Structure

```
sustainoss/
├── packages/
│   ├── backend/          # Node.js backend API
│   │   ├── src/
│   │   │   ├── analytics/    # Metrics and analysis
│   │   │   ├── api/          # REST API endpoints
│   │   │   ├── ingestion/    # Git data extraction
│   │   │   ├── jobs/         # Background jobs
│   │   │   ├── security/     # Security utilities
│   │   │   ├── storage/      # Database access
│   │   │   └── types/        # TypeScript types
│   │   └── scripts/      # Database setup scripts
│   └── frontend/         # React frontend
│       └── src/
│           ├── components/   # React components
│           ├── pages/        # Page components
│           ├── services/     # API clients
│           └── types/        # TypeScript types
└── docker-compose.yml    # Docker configuration
```

## Architecture Guidelines

### Backend

- **Separation of concerns**: Keep ingestion, analytics, storage, and API layers separate
- **Dependency injection**: Pass dependencies explicitly rather than using globals
- **Error handling**: Use try-catch blocks and return descriptive errors
- **Async/await**: Use async/await for asynchronous operations
- **Database access**: Use the repository pattern for data access

### Frontend

- **Component structure**: Keep components small and reusable
- **State management**: Use React hooks for local state
- **API calls**: Centralize API calls in service modules
- **Accessibility**: Follow WCAG 2.1 AA guidelines
- **Responsive design**: Ensure mobile compatibility

## Adding New Features

When adding a new feature:

1. **Create a specification** in following the existing format
2. **Define requirements** with clear acceptance criteria
3. **Design the solution** with interfaces and data models
4. **Write correctness properties** for property-based testing
5. **Implement incrementally** following the task breakdown
6. **Write tests** (both unit and property-based)
7. **Update documentation** as needed

## Property-Based Testing

SustainOSS uses property-based testing with fast-check to verify correctness properties:

- Each property test should run minimum 100 iterations
- Reference the design document property in test comments
- Use appropriate generators for input data
- Include shrinking to find minimal failing examples

Example:
```typescript
// Property 6: Gini Coefficient Bounds
it('should calculate Gini coefficient between 0 and 1', () => {
  fc.assert(
    fc.property(
      fc.array(fc.float({ min: 0, max: 1000 })),
      (distribution) => {
        const gini = calculateGiniCoefficient(distribution);
        expect(gini).toBeGreaterThanOrEqual(0);
        expect(gini).toBeLessThanOrEqual(1);
      }
    ),
    { numRuns: 100 }
  );
});
```

## Documentation

- Update README.md for user-facing changes
- Update DEPLOYMENT.md for deployment-related changes
- Add JSDoc comments for public APIs
- Update inline comments for complex logic
- Keep documentation in sync with code

## Review Process

All pull requests require:
- Passing CI checks (tests, linting)
- Code review from at least one maintainer
- Updated tests and documentation
- No merge conflicts with main branch

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Create a GitHub Issue
- **Security issues**: Email ab8991@srmist.edu.in (do not create public issues)

## License

By contributing to SustainOSS, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes for significant contributions
- Project README (for major features)

Thank you for contributing to SustainOSS! 🎉
