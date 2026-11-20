import * as core from './core'
import { Context } from './github'
import * as utils from './utils'
import { PullRequest } from './pull_request'
import { Client } from './types'
import { PullRequestEvent } from '@octokit/webhooks-types'

export interface PathFilteredReviewGroup {
  reviewers: string[]
  paths?: string[]
  excludePaths?: string[]
}

export type ReviewGroups = {
  [key: string]: string[] | PathFilteredReviewGroup
}

export interface Config {
  addReviewers: boolean
  addAssignees: boolean | string
  reviewers: string[]
  assignees: string[]
  filterLabels?: {
    include?: string[]
    exclude?: string[]
  }
  numberOfAssignees: number
  numberOfReviewers: number
  skipKeywords: string[]
  useReviewGroups: boolean
  useAssigneeGroups: boolean
  reviewGroups: ReviewGroups
  assigneeGroups: { [key: string]: string[] }
  runOnDraft?: boolean
  keepOnlyOneReviewer?: boolean
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
    useAssigneeGroups,
    reviewGroups,
    assigneeGroups,
    addReviewers,
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

  let changedPaths: string[] | undefined
  if (
    addReviewers &&
    useReviewGroups &&
    reviewGroups &&
    utils.hasPathFilteredGroups(reviewGroups)
  ) {
    try {
      const changedFiles = await pr.listChangedPaths()
      if (changedFiles.truncated) {
        core.warning(
          'The pull request contains more files than GitHub returned; selecting reviewers from all groups to avoid missing a required review'
        )
      } else {
        changedPaths = changedFiles.paths
      }
    } catch (error) {
      const message = error instanceof Error ? `: ${error.message}` : ''
      core.warning(
        `Unable to fetch changed pull request files; selecting reviewers from all groups${message}`
      )
    }
  }

  if (addReviewers) {
    try {
      const reviewers = utils.chooseReviewers(owner, config, changedPaths)

      if (reviewers.length > 0) {
        await pr.addReviewers(reviewers)

        if (config.keepOnlyOneReviewer) {
          await pr.keepOnlyOneReviewer(reviewers[0])
        }

        core.info(`Added reviewers to PR #${number}: ${reviewers.join(', ')}`)
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
