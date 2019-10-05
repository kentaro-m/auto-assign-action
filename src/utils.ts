import _ from 'lodash'
import * as github from '@actions/github'
import * as yaml from 'js-yaml'
import { Config } from './handler'

export function chooseReviewers(owner: string, config: Config): string[] {
  let reviewers: string[] = []
  const useGroups: boolean =
    config.useReviewGroups && Object.keys(config.reviewGroups).length > 0

  if (useGroups) {
    reviewers = chooseUsersFromGroups(
      owner,
      config.reviewGroups,
      config.numberOfReviewers
    )
  } else {
    reviewers = chooseUsers(config.reviewers, config.numberOfReviewers, owner)
  }

  return reviewers
}

export function chooseAssignees(owner: string, config: Config): string[] {
  let assignees: string[] = []

  const useGroups: boolean =
    config.useAssigneeGroups && Object.keys(config.assigneeGroups).length > 0

  if (typeof config.addAssignees === 'string') {
    if (config.addAssignees !== 'author') {
      throw new Error(
        "Error in configuration file to do with using addAssignees. Expected 'addAssignees' variable to be either boolean or 'author'"
      )
    }
    assignees = [owner]
  } else if (useGroups) {
    assignees = chooseUsersFromGroups(
      owner,
      config.assigneeGroups,
      config.numberOfAssignees || config.numberOfReviewers
    )
  } else {
    const candidates = config.assignees ? config.assignees : config.reviewers
    assignees = chooseUsers(
      candidates,
      config.numberOfAssignees || config.numberOfReviewers,
      owner
    )
  }

  return assignees
}

export function chooseUsers(
  candidates: string[],
  desiredNumber: number,
  filterUser: string = ''
): string[] {
  const filteredCandidates = candidates.filter((reviewer: string): boolean => {
    return reviewer !== filterUser
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
  groups: { [key: string]: string[] } | undefined,
  desiredNumber: number
): string[] {
  let users: string[] = []
  for (const group in groups) {
    users = users.concat(chooseUsers(groups[group], desiredNumber, owner))
  }
  return users
}

export async function fetchConfigurationFile(client: github.GitHub, options) {
  const { owner, repo, path, ref } = options
  const result = await client.repos.getContents({
    owner,
    repo,
    path,
    ref,
  })

  const data: any = result.data

  if (!data.content) {
    throw new Error('the configuration file is not found')
  }

  const configString = Buffer.from(data.content, 'base64').toString()
  const config = yaml.safeLoad(configString)

  return config
}
