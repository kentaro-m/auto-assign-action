import * as github from '@actions/github'
import * as core from '@actions/core'
import { Context } from '@actions/github/lib/context'

export class PullRequest {
  private client: github.GitHub
  private context: Context

  constructor(client: github.GitHub, context: Context) {
    this.client = client
    this.context = context
  }

  async addReviewers(reviewers: string[]): Promise<void> {
    const result = await this.client.pulls.createReviewRequest({
      ...this.context.issue,
      reviewers,
    })
    core.debug(JSON.stringify(result))
  }

  async addAssignees(assignees: string[]): Promise<void> {
    const result = await this.client.issues.addAssignees({
      ...this.context.issue,
      assignees,
    })
    core.debug(JSON.stringify(result))
  }
}
