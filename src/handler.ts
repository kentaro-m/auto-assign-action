import * as core from '@actions/core'
import * as github from '@actions/github'
import { Context } from '@actions/github/lib/context'
import * as utils from './utils'
import { PullRequest } from './pull_request'

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

export async function handlePullRequest(
  client: github.GitHub,
  context: Context,
  config: Config
) {
  if (!context.payload.pull_request) {
    throw new Error('the webhook payload is not exist')
  }

  const { title, draft, user } = context.payload.pull_request
  const {
    skipKeywords,
    useReviewGroups,
    useAssigneeGroups,
    reviewGroups,
    assigneeGroups,
    addReviewers,
    addAssignees,
  } = config

  if (skipKeywords && utils.includesSkipKeywords(title, skipKeywords)) {
    console.log('skips adding reviewers')
    return
  }
  if (draft) {
    console.log('ignore draft PR')
    return
  }

  if (useReviewGroups && !reviewGroups) {
    throw new Error(
      "Error in configuration file to do with using review groups. Expected 'reviewGroups' variable to be set because the variable 'useReviewGroups' = true."
    )
  }

  if (useAssigneeGroups && !assigneeGroups) {
    throw new Error(
      "Error in configuration file to do with using review groups. Expected 'assigneeGroups' variable to be set because the variable 'useAssigneeGroups' = true."
    )
  }

  const owner = user.login
  const pr = new PullRequest(client, context)

  if (addReviewers) {
    try {
      const reviewers = utils.chooseReviewers(owner, config)

      if (reviewers.length > 0) {
        await pr.addReviewers(reviewers)
      }
    } catch (error) {
      core.debug(error.message)
    }
  }

  if (addAssignees) {
    try {
      const assignees = utils.chooseAssignees(owner, config)

      if (assignees.length > 0) {
        await pr.addAssignees(assignees)
      }
    } catch (error) {
      core.debug(error.message)
    }
  }
}
