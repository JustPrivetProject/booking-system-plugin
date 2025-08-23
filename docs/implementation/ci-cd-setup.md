# CI/CD Setup Guide

This document describes the continuous integration and deployment setup for the Chrome Booking System Plugin.

## Overview

The project uses GitHub Actions for automated testing, code coverage reporting, and releases. The CI/CD pipeline ensures code quality and automates the deployment process.

## Workflows

### 1. Test Workflow (`.github/workflows/test.yml`)

**Triggers:**
- Push to feature branches (excludes `main`, `dev`)
- Called by other workflows via `workflow_call`
- Changes to source code, tests, or configuration files

**Jobs:**
- **Linting**: ESLint validation (errors only, warnings ignored)
- **Testing**: Jest unit tests with coverage reporting
- **Coverage**: Uploads coverage reports to Codecov
- **Build Test**: Validates that both production and development builds succeed

**Features:**
- Minimum 40% line coverage requirement
- Automatic PR comments with coverage reports
- JUnit test reports for GitHub UI
- Bundle size analysis

### 2. Release Workflow (`.github/workflows/release.yml`)

**Triggers:**
- Pull requests to `main` and `dev` branches
- Push to `main` branch (production releases)
- Push to `dev` branch (development releases)  
- Manual tag creation

**Jobs:**
- **test-pull-request**: Runs tests for PR validation
- **test-production**: Runs tests before production releases
- **test-development**: Runs tests before development releases
- **build-and-release**: Creates production releases
- **build-and-release-dev**: Creates development releases

**Dependencies:**
- All releases depend on successful test completion
- Ensures no releases without passing tests

**Environments:**
- **Production**: Releases from `main` branch
- **Development**: Pre-releases from `dev` branch

## Setup Instructions

### 1. Repository Secrets

Add the following secrets to your GitHub repository:

```bash
# Required for Codecov integration
CODECOV_TOKEN=your_codecov_token

# Required for production builds
CRYPTO_SECRET_KEY=your_secret_key
SUPABASE_ANON_KEY=your_supabase_key
SUPABASE_URL=your_supabase_url
```

### 2. Codecov Integration

1. Visit [codecov.io](https://codecov.io)
2. Connect your GitHub repository
3. Copy the upload token
4. Add it as `CODECOV_TOKEN` in repository secrets

### 3. Branch Protection Rules

Configure branch protection for `main` and `dev` branches:

**Required settings:**
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Include administrators in restrictions

**Required status checks:**
- `Run Tests and Coverage`
- `Build Test`

### 4. Development Workflow

1. **Feature Development:**
   ```bash
   git checkout -b feature/your-feature
   # Make changes
   git push origin feature/your-feature
   # Create PR to dev branch
   ```

2. **Testing:**
   ```bash
   # Run tests locally
   npm test
   npm run test:coverage
   npm run lint:check
   ```

3. **Release Process:**
   - Merge to `dev` → Creates development release
   - Merge to `main` → Creates production release

## Coverage Configuration

### Jest Configuration

Coverage is configured in `jest.config.js`:

```javascript
coverageThreshold: {
    global: {
        branches: 40,
        functions: 40,
        lines: 40,
        statements: 40,
    },
}
```

### Codecov Configuration

Coverage rules are defined in `codecov.yml`:

- **Project Coverage**: 40% target
- **Patch Coverage**: 40% target
- **Threshold**: 1% for project, 5% for patches

## Quality Gates

The following quality gates are enforced:

1. **Code Coverage**: Minimum 40% line coverage
2. **Linting**: ESLint errors must be resolved (warnings allowed)
3. **Build Validation**: Both dev and production builds must succeed
4. **Test Execution**: All unit tests must pass

## Badges

The following badges are available in README.md:

- **Tests**: Shows test workflow status
- **Build**: Shows release workflow status  
- **Coverage**: Shows current code coverage percentage
- **License**: Displays project license
- **Node.js**: Shows required Node.js version

## Monitoring

### GitHub Actions

Monitor workflow runs in the **Actions** tab of your repository:
- View detailed logs for each step
- Check test results and coverage reports
- Monitor build times and resource usage

### Codecov Dashboard

Use the Codecov dashboard to:
- Track coverage trends over time
- Identify uncovered code areas
- Review coverage reports for each commit

## Troubleshooting

### Common Issues

1. **Coverage Below Threshold:**
   - Write additional tests for uncovered code
   - Review coverage report in `coverage/lcov-report/index.html`

2. **Build Failures:**
   - Check TypeScript compilation errors
   - Verify all dependencies are properly installed

3. **Test Failures:**
   - Run tests locally to reproduce issues
   - Check test output in GitHub Actions logs

4. **Test Reporter Permissions Error:**
   - Error: "Resource not accessible by integration" with dorny/test-reporter
   - **Solution**: Ensure workflow has proper permissions:
     ```yaml
     permissions:
         contents: read
         checks: write
         pull-requests: write
     ```
   - **Solution**: Add GITHUB_TOKEN to test reporter step:
     ```yaml
     - name: Generate test report
       uses: dorny/test-reporter@v1
       with:
         token: ${{ secrets.GITHUB_TOKEN }}
     ```

5. **Reusable Workflow Permissions Error:**
   - Error: "The workflow is requesting 'checks: write, pull-requests: write', but is only allowed 'checks: none, pull-requests: none'"
   - **Problem**: Reusable workflows inherit only explicitly granted permissions from calling workflow
   - **Best Solution (2024)**: Configure repository-level permissions:
     1. Go to **Repository Settings** → **Actions** → **General**
     2. Under **Workflow permissions** select **"Read and write permissions"**
     3. Check **"Allow GitHub Actions to create and approve pull requests"**
     4. Remove all explicit `permissions:` from workflow files
   - **Alternative Solution** (if repo permissions can't be changed):
     ```yaml
     # Add global permissions to workflow level
     permissions:
       contents: read
       checks: write
       pull-requests: write
     ```
   - **Benefits**: 
     - Works with restricted repository settings
     - Resolves reusable workflow conflicts
     - Centralized permissions per workflow

### Local Development

To match CI environment locally:

```bash
# Install exact dependencies
npm ci

# Run all quality checks
npm run check-all

# Test with coverage
npm run test:coverage
```

## Best Practices

1. **Write Tests First**: Follow TDD approach when possible
2. **Maintain Coverage**: Keep coverage above 40%
3. **Small PRs**: Create focused, reviewable pull requests
4. **Clear Commits**: Use descriptive commit messages
5. **Update Documentation**: Keep docs in sync with changes
