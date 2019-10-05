import * as core from '@actions/core'
import * as github from '@actions/github'
import { Context } from '@actions/github/lib/context'
import * as utils from './utils'
import AutoAssign from './auto_assign'

interface AppConfig {
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

export async function handlePullRequest(client: github.GitHub, context: Context, config: AppConfig) {
  if (!context.payload.pull_request) {
    throw new Error('the webhook payload is not exist')
  }

  const title = context.payload.pull_request.title
  if (config.skipKeywords && utils.includesSkipKeywords(title, config.skipKeywords)) {
    console.log('skips adding reviewers')
    return
  }
  if (context.payload.pull_request.draft) {
    console.log('ignore draft PR')
    return
  }

  if (config.useReviewGroups && !config.reviewGroups) {
    throw new Error(
      "Error in configuration file to do with using review groups. Expected 'reviewGroups' variable to be set because the variable 'useReviewGroups' = true."
    )
  }

  if (config.useAssigneeGroups && !config.assigneeGroups) {
    throw new Error(
      "Error in configuration file to do with using review groups. Expected 'assigneeGroups' variable to be set because the variable 'useAssigneeGroups' = true."
    )
  }

  const autoAssign = new AutoAssign(client, context, config)

  if (config.addReviewers) {
    try {
      await autoAssign.addReviewers()
    } catch (error) {
      core.debug(error.message)
    }
  }

  if (config.addAssignees) {
    try {
      await autoAssign.addAssignees()
    } catch (error) {
      core.debug(error.message)
    }
  }
}