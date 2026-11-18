import * as core from '@actions/core'
import { Context } from '@actions/github/lib/context'
import { Client } from './types'

export class PullRequest {
  private client: Client
  private context: Context

  constructor(client: Client, context: Context) {
    this.client = client
    this.context = context
  }

  async addReviewers(
    reviewers: string[],
    teamReviewers: string[] = []
  ): Promise<void> {
    const { owner, repo, number: pull_number } = this.context.issue
    const requestData: any = {
      owner,
      repo,
      pull_number,
    }

    if (reviewers.length > 0) {
      requestData.reviewers = reviewers
    }

    if (teamReviewers.length > 0) {
      requestData.team_reviewers = teamReviewers
    }

    const result = await this.client.rest.pulls.requestReviewers(requestData)
    core.debug(JSON.stringify(result))
  }

  async addAssignees(assignees: string[]): Promise<void> {
    const { owner, repo, number: issue_number } = this.context.issue
    const result = await this.client.rest.issues.addAssignees({
      owner,
      repo,
      issue_number,
      assignees,
    })
    core.debug(JSON.stringify(result))
  }

  hasAnyLabel(labels: string[]): boolean {
    if (!this.context.payload.pull_request) {
      return false
    }
    const { labels: pullRequestLabels = [] } = this.context.payload.pull_request
    return pullRequestLabels.some((label) => labels.includes(label.name))
  }
}
