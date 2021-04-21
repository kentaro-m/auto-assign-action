import _ from 'lodash'
import * as github from '@actions/github'
import * as yaml from 'js-yaml'
import { Config } from './handler'

export function chooseReviewers(owner: string, config: Config): string[] {
  const { useReviewGroups, reviewGroups, numberOfReviewers, reviewers } = config
  let chosenReviewers: string[] = []
  const useGroups: boolean =
    useReviewGroups && Object.keys(reviewGroups).length > 0

  if (useGroups) {
    chosenReviewers = chooseUsersFromGroups(
      owner,
      reviewGroups,
      numberOfReviewers
    )
  } else {
    chosenReviewers = chooseUsers(reviewers, numberOfReviewers, owner)
  }

  return chosenReviewers
}

export function chooseAssignees(
  owner: string,
  userType: string,
  config: Config
): string[] {
  const {
    useAssigneeGroups,
    assigneeGroups,
    addAssignees,
    numberOfAssignees,
    numberOfReviewers,
    assignees,
    reviewers,
    random,
    randomAssignees,
  } = config
  let chosenAssignees: string[] = []
  const userTypeRegex = new RegExp('^Bot$')
  const useGroups: boolean =
    useAssigneeGroups && Object.keys(assigneeGroups).length > 0

  if (random && userTypeRegex.test(userType)) {
    if (randomAssignees.length === 0) {
      throw new Error(
        "Error in configuration file to do with using randomAssignees. Expected 'randomAssignees' variable to be list of users"
      )
    }
    const randomSelection =
      randomAssignees[Math.floor(Math.random() * randomAssignees.length)]
    return [randomSelection]
  }

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
