import * as core from '@actions/core'
import * as github from '@actions/github'
import { Context } from '@actions/github/lib/context'
import { chooseUsers, chooseUsersFromGroups } from './utils'

interface Config {
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
    const useGroups: boolean =
      this.config.useReviewGroups &&
      Object.keys(this.config.reviewGroups).length > 0

    if (useGroups) {
      this.reviewers = chooseUsersFromGroups(
        owner,
        this.config.reviewGroups,
        this.config.numberOfReviewers
      )
    } else {
      this.reviewers = chooseUsers(
        this.config.reviewers,
        this.config.numberOfReviewers,
        owner
      )
    }

    if (this.config.addReviewers && this.reviewers.length > 0) {
      
      const result = await this.client.pulls.createReviewRequest({
        ...this.context.issue,
        reviewers: this.reviewers,
      })
      core.debug(JSON.stringify(result))
    }
  }

  public async addAssignees(): Promise<void> {
    let assignees: string[] = []

    if (!this.context.payload.pull_request) {
      throw new Error('the webhook payload is not exist')
    }

    const owner = this.context.payload.pull_request.user.login
    const useGroups: boolean =
      this.config.useAssigneeGroups &&
      Object.keys(this.config.assigneeGroups).length > 0

    if (typeof this.config.addAssignees === 'string') {
      if (this.config.addAssignees !== 'author') {
        throw new Error(
          "Error in configuration file to do with using addAssignees. Expected 'addAssignees' variable to be either boolean or 'author'"
        )
      }
      assignees = [owner]
    } else if (useGroups) {
      assignees = chooseUsersFromGroups(
        owner,
        this.config.assigneeGroups,
        this.config.numberOfAssignees || this.config.numberOfReviewers
      )
    } else {
      const candidates = this.config.assignees
        ? this.config.assignees
        : this.config.reviewers
      assignees = chooseUsers(
        candidates,
        this.config.numberOfAssignees || this.config.numberOfReviewers,
        owner
      )
    }

    if (assignees.length > 0) {
      const result = await this.client.issues.addAssignees({
        ...this.context.issue,
        assignees
      })
      core.debug(JSON.stringify(result))
    }
  }
}