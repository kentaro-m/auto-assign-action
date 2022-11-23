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
    const { owner, repo, number: pull_number } = this.context.issue
    const result = await this.client.pulls.createReviewRequest({
      owner,
      repo,
      pull_number,
      reviewers,
    })
    core.debug(JSON.stringify(result))
  }

  async addAssignees(assignees: string[]): Promise<void> {
    const { owner, repo, number: issue_number } = this.context.issue
    const result = await this.client.issues.addAssignees({
      owner,
      repo,
      issue_number,
      assignees,
    })
    core.debug(JSON.stringify(result))
  }

  async hasAnyLabel(labels: string[]): Promise<boolean> {
    const { owner, repo, number: pull_number } = this.context.issue

    const pull = await this.client.pulls.get({
      owner,
      repo,
      pull_number,
    })

    if (pull == null) {
      return false
    }

    const { labels: prLabels = [] } = pull.data

    return prLabels.some(label => labels.includes(label.name))
  }
}
