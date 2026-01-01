# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Auto Assign Action is a GitHub Action that automatically adds reviewers and/or assignees to pull requests when they are opened. The action reads a YAML configuration file (default: `.github/auto_assign.yml`) and assigns users based on single or grouped reviewer lists, with support for filtering by labels, draft status, and skip keywords.

## Development Commands

### Build and Test
```bash
npm run build          # Compile TypeScript to lib/ directory
npm test               # Run all Jest tests
npm run format         # Format all TypeScript files with Prettier
npm run format-check   # Check formatting without modifying files
npm run package        # Bundle with ncc into dist/index.js for distribution
```

### Running Individual Tests
```bash
npm test -- __tests__/utils.test.ts           # Run specific test file
npm test -- -t "test name pattern"            # Run tests matching pattern
```

## Architecture

### Entry Point Flow
1. **main.ts** - Entry point that calls `run()`
2. **run.ts** - Orchestrates the action:
   - Fetches inputs (`repo-token`, `configuration-path`)
   - Creates GitHub Octokit client
   - Loads config from repository using `utils.fetchConfigurationFile()`
   - Delegates to `handler.handlePullRequest()`

### Core Components

**handler.ts** - Main business logic
- `handlePullRequest()`: Validates PR against filters (skip keywords, draft status, labels), then adds reviewers and assignees
- `Config` interface: Defines all configuration options from YAML file
- Filters execute in order: skip keywords → draft check → label filters → assignment

**utils.ts** - Selection logic
- `chooseReviewers()` / `chooseAssignees()`: Select users from single list or groups
- `chooseUsers()`: Filters out PR creator, returns all users if `numberOfReviewers: 0`, otherwise randomly samples
- `chooseUsersFromGroups()`: Iterates groups and selects users from each
- `fetchConfigurationFile()`: Retrieves and parses YAML config from repository via GitHub API

**pull_request.ts** - GitHub API wrapper
- `PullRequest` class encapsulates context and client
- `addReviewers()`: Calls `pulls.requestReviewers` API
- `addAssignees()`: Calls `issues.addAssignees` API (PRs are issues)
- `hasAnyLabel()`: Checks if PR has any of the specified labels

### Configuration System

The action expects a YAML configuration file (default `.github/auto_assign.yml`) with these key options:
- `addReviewers` / `addAssignees`: Enable reviewer/assignee assignment
- `reviewers` / `assignees`: Single list mode
- `useReviewGroups` / `useAssigneeGroups`: Enable grouped mode
- `reviewGroups` / `assigneeGroups`: Multiple lists keyed by group name
- `numberOfReviewers` / `numberOfAssignees`: How many to assign (0 = all)
- `skipKeywords`: Skip assignment if PR title contains these
- `filterLabels.include` / `filterLabels.exclude`: Label-based filtering
- `runOnDraft`: Whether to run on draft PRs (default: false)
- Special: `addAssignees: "author"` assigns PR creator as assignee

### Key Behaviors

- **PR Creator Exclusion**: The PR author is always filtered out from reviewers/assignees (unless `addAssignees: "author"`)
- **Random Sampling**: When `numberOfReviewers` > 0, uses `lodash.sampleSize()` for random selection
- **Group Mode**: When using groups, the specified number is selected from EACH group, not total
- **Error Handling**: Reviewer/assignee addition failures are logged as warnings, not failures
- **Configuration Validation**: Throws errors if group flags are enabled but group lists are missing

### Distribution

The action uses `@vercel/ncc` to bundle everything into `dist/index.js`. After making changes:
1. Run `npm run build` to compile TypeScript
2. Run `npm run package` to create the bundled distribution
3. Commit both `lib/` and `dist/` directories

The action runs on Node 20 (specified in `action.yml`).

### Testing

Tests use Jest with ts-jest transformer. Test files mirror source structure:
- `__tests__/utils.test.ts` - Tests selection logic and utility functions
- `__tests__/handler.test.ts` - Tests main handler logic and filtering
- `__tests__/run.test.ts` - Tests action entry point

Mock `@actions/github` for testing without real API calls.
