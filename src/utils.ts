import _ from 'lodash'
import * as yaml from 'js-yaml'
import { minimatch } from 'minimatch'
import type { Config, PathFilteredReviewGroup, ReviewGroups } from './handler'
import { getRepositoryContent } from './github'
import { Client } from './types'

const globOptions = { dot: true, nonegate: true }

export function chooseReviewers(
  owner: string,
  config: Config,
  changedPaths?: string[]
): string[] {
  const { useReviewGroups, reviewGroups, numberOfReviewers, reviewers } = config
  let chosenReviewers: string[] = []
  const useGroups: boolean =
    useReviewGroups && Object.keys(reviewGroups).length > 0

  if (useGroups) {
    chosenReviewers = chooseUsersFromGroups(
      owner,
      reviewGroups,
      numberOfReviewers,
      changedPaths
    )
  } else {
    chosenReviewers = chooseUsers(reviewers, numberOfReviewers, owner)
  }

  if (config.keepOnlyOneReviewer && chosenReviewers.length > 1) {
    chosenReviewers = _.sampleSize(chosenReviewers, 1)
  }

  return chosenReviewers
}

export function chooseAssignees(owner: string, config: Config): string[] {
  const {
    useAssigneeGroups,
    assigneeGroups,
    addAssignees,
    numberOfAssignees,
    numberOfReviewers,
    assignees,
    reviewers,
  } = config
  let chosenAssignees: string[] = []

  const useGroups: boolean =
    useAssigneeGroups && Object.keys(assigneeGroups).length > 0

  if (typeof addAssignees === 'string') {
    if (addAssignees !== 'author') {
      throw new Error(
        "Error in configuration file to do with using addAssignees. Expected 'addAssignees' variable to be either boolean or 'author'"
      )
    }
    chosenAssignees = [owner]
  } else if (useGroups) {
    chosenAssignees = chooseUsersFromGroups(
      owner,
      assigneeGroups,
      numberOfAssignees || numberOfReviewers
    )
  } else {
    const candidates = assignees ? assignees : reviewers
    chosenAssignees = chooseUsers(
      candidates,
      numberOfAssignees || numberOfReviewers,
      owner
    )
  }

  return chosenAssignees
}

export function chooseUsers(
  candidates: string[],
  desiredNumber: number,
  filterUser: string = ''
): string[] {
  const filteredCandidates = candidates.filter((reviewer: string): boolean => {
    return reviewer.toLowerCase() !== filterUser.toLowerCase()
  })

  // all-assign
  if (desiredNumber === 0) {
    return filteredCandidates
  }

  return _.sampleSize(filteredCandidates, desiredNumber)
}

export function includesSkipKeywords(
  title: string,
  skipKeywords: string[]
): boolean {
  for (const skipKeyword of skipKeywords) {
    if (title.toLowerCase().includes(skipKeyword.toLowerCase()) === true) {
      return true
    }
  }

  return false
}

export function chooseUsersFromGroups(
  owner: string,
  groups: ReviewGroups | undefined,
  desiredNumber: number,
  changedPaths?: string[]
): string[] {
  let users: string[] = []
  for (const group in groups) {
    const groupConfig = groups[group]
    if (!groupMatchesChangedPaths(groupConfig, changedPaths)) {
      continue
    }

    const candidates = Array.isArray(groupConfig)
      ? groupConfig
      : groupConfig.reviewers
    if (!Array.isArray(candidates)) {
      throw new Error(
        `Expected reviewers for review group '${group}' to be a list`
      )
    }
    users = users.concat(chooseUsers(candidates, desiredNumber, owner))
  }
  return deduplicateUsers(users)
}

export function hasPathFilteredGroups(groups: ReviewGroups): boolean {
  return Object.values(groups).some(
    (group) =>
      !Array.isArray(group) &&
      ((group.paths !== undefined && group.paths.length > 0) ||
        (group.excludePaths !== undefined && group.excludePaths.length > 0))
  )
}

export function groupMatchesChangedPaths(
  group: string[] | PathFilteredReviewGroup,
  changedPaths?: string[]
): boolean {
  if (Array.isArray(group) || changedPaths === undefined) {
    return true
  }

  const includePaths =
    group.paths !== undefined && group.paths.length > 0 ? group.paths : ['**']
  const excludePaths = group.excludePaths || []

  return changedPaths.some(
    (path) =>
      includePaths.some((pattern) => minimatch(path, pattern, globOptions)) &&
      !excludePaths.some((pattern) => minimatch(path, pattern, globOptions))
  )
}

function deduplicateUsers(users: string[]): string[] {
  const seen = new Set<string>()
  return users.filter((user) => {
    const normalizedUser = user.toLowerCase()
    if (seen.has(normalizedUser)) {
      return false
    }
    seen.add(normalizedUser)
    return true
  })
}

export async function fetchConfigurationFile(client: Client, options) {
  const { owner, repo, path, ref } = options
  const result = await getRepositoryContent(client, {
    owner,
    repo,
    path,
    ref,
  })

  const data = result.data

  if (Array.isArray(data) || !('content' in data) || !data.content) {
    throw new Error('the configuration file is not found')
  }

  const configString = Buffer.from(data.content, 'base64').toString()
  const config = yaml.safeLoad(configString)

  return config
}
