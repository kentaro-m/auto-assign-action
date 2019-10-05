import * as core from '@actions/core'
import * as github from '@actions/github'
import { Context } from '@actions/github/lib/context'
import { chooseReviewers, chooseAssignees } from './utils'

export interface Config {
  addReviewers: boolean
  addAssignees: boolean | string
  reviewers: string[]
  assignees: string[]
  numberOfAssignees: number
  numberOfReviewers: number
  skipKeywords: string[]
  useReviewGroups: boolean
  useAssigneeGroups: boolean
  reviewGroups: { [key: string]: string[] }
  assigneeGroups: { [key: string]: string[] }
}

export default class AutoAssign {
  private client: github.GitHub
  private config: Config
  private context: Context
  private reviewers: string[]

  public constructor(client: github.GitHub, context: Context, config: Config) {
    this.client = client
    this.config = config
    this.context = context
    this.reviewers = []
  }

  public async addReviewers(): Promise<void> {
    if (!this.context.payload.pull_request) {
      throw new Error('the webhook payload is not exist')
    }

    const owner = this.context.payload.pull_request.user.login

    this.reviewers = chooseReviewers(owner, this.config) 

    if (this.config.addReviewers && this.reviewers.length > 0) {
      const result = await this.client.pulls.createReviewRequest({
        ...this.context.issue,
        reviewers: this.reviewers,
      })
      core.debug(JSON.stringify(result))
    }
  }

  public async addAssignees(): Promise<void> {
    if (!this.context.payload.pull_request) {
      throw new Error('the webhook payload is not exist')
    }

    const owner = this.context.payload.pull_request.user.login
    const assignees = chooseAssignees(owner, this.config)

    if (assignees.length > 0) {
      const result = await this.client.issues.addAssignees({
        ...this.context.issue,
        assignees,
      })
      core.debug(JSON.stringify(result))
    }
  }
}
