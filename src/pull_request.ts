import * as core from './core'
import {
  addAssignees,
  Context,
  listPullRequestFiles,
  listRequestedReviewers,
  removeRequestedReviewers,
  requestReviewers,
} from './github'
import { Client } from './types'

export interface ChangedPaths {
  paths: string[]
  truncated: boolean
}

export class PullRequest {
  private client: Client
  private context: Context

  constructor(client: Client, context: Context) {
    this.client = client
    this.context = context
  }

  async addReviewers(reviewers: string[]): Promise<void> {
    const { owner, repo, number: pull_number } = this.context.issue
    const result = await requestReviewers(this.client, {
      owner,
      repo,
      pull_number,
      reviewers,
    })
    core.debug(JSON.stringify(result))
  }

  async addAssignees(assignees: string[]): Promise<void> {
    const { owner, repo, number: issue_number } = this.context.issue
    const result = await addAssignees(this.client, {
      owner,
      repo,
      issue_number,
      assignees,
    })
    core.debug(JSON.stringify(result))
  }

  async listChangedPaths(): Promise<ChangedPaths> {
    const { owner, repo, number: pull_number } = this.context.issue
    const files = await listPullRequestFiles(this.client, {
      owner,
      repo,
      pull_number,
      per_page: 100,
    })

    const paths = new Set<string>()
    for (const file of files) {
      paths.add(file.filename)
      if (file.previous_filename) {
        paths.add(file.previous_filename)
      }
    }

    const changedFileCount = this.context.payload.pull_request?.changed_files
    return {
      paths: Array.from(paths),
      truncated:
        typeof changedFileCount === 'number' && changedFileCount > files.length,
    }
  }

  hasAnyLabel(labels: string[]): boolean {
    if (!this.context.payload.pull_request) {
      return false
    }
    const { labels: pullRequestLabels = [] } = this.context.payload.pull_request
    return pullRequestLabels.some((label) => labels.includes(label.name))
  }

  async keepOnlyOneReviewer(reviewer: string): Promise<void> {
    const { owner, repo, number: pull_number } = this.context.issue
    const { data } = await listRequestedReviewers(this.client, {
      owner,
      repo,
      pull_number,
    })

    const reviewersToRemove = data.users
      .filter((user) => {
        const isBot =
          user.type.toLowerCase() === 'bot' ||
          user.login.toLowerCase().endsWith('[bot]')

        return !isBot && user.login.toLowerCase() !== reviewer.toLowerCase()
      })
      .map((user) => user.login)

    const teamsToRemove = data.teams.map((team) => team.slug)

    if (reviewersToRemove.length === 0 && teamsToRemove.length === 0) {
      return
    }

    await removeRequestedReviewers(this.client, {
      owner,
      repo,
      pull_number,
      reviewers: reviewersToRemove,
      team_reviewers: teamsToRemove,
    })
  }
}
