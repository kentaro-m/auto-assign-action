import * as core from '@actions/core'
import { Context } from '@actions/github/lib/context'
import * as utils from './utils'
import { PullRequest } from './pull_request'
import { Client } from './types'
import { PullRequestEvent } from '@octokit/webhooks-types'

export interface Config {
  addReviewers: boolean
  addTeamReviewers: boolean
  addAssignees: boolean | string
  reviewers: string[]
  teamReviewers: string[]
  assignees: string[]
  filterLabels?: {
    include?: string[]
    exclude?: string[]
  }
  numberOfAssignees: number
  numberOfReviewers: number
  numberOfTeamReviewers: number
  skipKeywords: string[]
  useReviewGroups: boolean
  useTeamReviewGroups: boolean
  useAssigneeGroups: boolean
  reviewGroups: { [key: string]: string[] }
  teamReviewGroups: { [key: string]: string[] }
  assigneeGroups: { [key: string]: string[] }
  runOnDraft?: boolean
}

export async function handlePullRequest(
  client: Client,
  context: Context,
  config: Config
) {
  if (!context.payload.pull_request) {
    throw new Error('the webhook payload is not exist')
  }

  const { pull_request: event } = context.payload as PullRequestEvent
  const { title, draft, user, number } = event
  const {
    skipKeywords,
    useReviewGroups,
    useTeamReviewGroups,
    useAssigneeGroups,
    reviewGroups,
    teamReviewGroups,
    assigneeGroups,
    addReviewers,
    addTeamReviewers,
    addAssignees,
    filterLabels,
    runOnDraft,
  } = config

  if (skipKeywords && utils.includesSkipKeywords(title, skipKeywords)) {
    core.info(
      'Skips the process to add reviewers/assignees since PR title includes skip-keywords'
    )
    return
  }
  if (!runOnDraft && draft) {
    core.info(
      'Skips the process to add reviewers/assignees since PR type is draft'
    )
    return
  }

  if (useReviewGroups && !reviewGroups) {
    throw new Error(
      "Error in configuration file to do with using review groups. Expected 'reviewGroups' variable to be set because the variable 'useReviewGroups' = true."
    )
  }

  if (useTeamReviewGroups && !teamReviewGroups) {
    throw new Error(
      "Error in configuration file to do with using review groups. Expected 'teamReviewGroups' variable to be set because the variable 'useTeamReviewGroups' = true."
    )
  }

  if (useAssigneeGroups && !assigneeGroups) {
    throw new Error(
      "Error in configuration file to do with using review groups. Expected 'assigneeGroups' variable to be set because the variable 'useAssigneeGroups' = true."
    )
  }

  const owner = user.login
  const pr = new PullRequest(client, context)

  if (filterLabels !== undefined) {
    if (filterLabels.include !== undefined && filterLabels.include.length > 0) {
      const hasLabels = pr.hasAnyLabel(filterLabels.include)
      if (!hasLabels) {
        core.info(
          'Skips the process to add reviewers/assignees since PR is not tagged with any of the filterLabels.include'
        )
        return
      }
    }

    if (filterLabels.exclude !== undefined && filterLabels.exclude.length > 0) {
      const hasLabels = pr.hasAnyLabel(filterLabels.exclude)
      if (hasLabels) {
        core.info(
          'Skips the process to add reviewers/assignees since PR is tagged with any of the filterLabels.exclude'
        )
        return
      }
    }
  }

  if (addReviewers) {
    try {
      const reviewers = utils.chooseReviewers(owner, config)

      if (reviewers.length > 0) {
        await pr.addReviewers(reviewers)
        core.info(`Added reviewers to PR #${number}: ${reviewers.join(', ')}`)
      }
    } catch (error) {
      if (error instanceof Error) {
        core.warning(error.message)
      }
    }
  }

  if (addTeamReviewers) {
    try {
      const teamReviewers = utils.chooseTeamReviewers(owner, config)

      if (teamReviewers.length > 0) {
        await pr.addTeamReviewers(teamReviewers)
        core.info(
          `Added team reviewers to PR #${number}: ${teamReviewers.join(', ')}`
        )
      }
    } catch (error) {
      if (error instanceof Error) {
        core.warning(error.message)
      }
    }
  }

  if (addAssignees) {
    try {
      const assignees = utils.chooseAssignees(owner, config)

      if (assignees.length > 0) {
        await pr.addAssignees(assignees)
        core.info(`Added assignees to PR #${number}: ${assignees.join(', ')}`)
      }
    } catch (error) {
      if (error instanceof Error) {
        core.warning(error.message)
      }
    }
  }
}
