import { chooseUsers, chooseUsersFromGroups, includesSkipKeywords, fetchConfigurationFile } from '../src/utils'
import * as github from '@actions/github'

jest.mock('@actions/github')

describe('chooseUsers', () => {
  test('returns the reviewer list without the PR creator', () => {
    const prCreator = 'pr-creator'
    const reviewers = ['reviewer1','reviewer2', 'reviewer3', 'pr-creator']
    const numberOfReviewers = 0

    const list = chooseUsers(reviewers, numberOfReviewers, prCreator)

    expect(list).toEqual(['reviewer1','reviewer2', 'reviewer3'])
  })

  test('returns the only other reviewer', () => {
    const prCreator = 'pr-creator'
    const reviewers = ['reviewer1', 'pr-creator']
    const numberOfReviewers = 1

    const list = chooseUsers(reviewers, numberOfReviewers, prCreator)

    expect(list).toEqual(['reviewer1'])
  })

  test('returns the reviewer list if the number of reviewers is setted', () => {
    const prCreator = 'pr-creator'
    const reviewers = ['reviewer1','reviewer2', 'reviewer3', 'pr-creator']
    const numberOfReviewers = 2

    const list = chooseUsers(reviewers, numberOfReviewers, prCreator)

    expect(list.length).toEqual(2)
  })

  test('returns empty array if the reviewer is the PR creator', () => {
    const prCreator = 'pr-creator'
    const reviewers = ['pr-creator']
    const numberOfReviewers = 0

    const list = chooseUsers(reviewers, numberOfReviewers, prCreator)

    expect(list.length).toEqual(0)
  })

  test('returns full reviewer array if not passing the user to filter out', () => {
    const reviewers = ['pr-creator']
    const numberOfReviewers = 0

    const list = chooseUsers(reviewers, numberOfReviewers)

    expect(list).toEqual(expect.arrayContaining(['pr-creator']))
  })
})

describe('includesSkipKeywords', () => {
  test('returns true if the pull request title includes skip word', () => {
    const title = 'WIP add a new feature'
    const skipWords = ['wip']

    const contains = includesSkipKeywords(title, skipWords)

    expect(contains).toEqual(true)
  })

  test('returns false if the pull request title does not include skip word', () => {
    const title = 'add a new feature'
    const skipWords = ['wip']

    const contains = includesSkipKeywords(title, skipWords)

    expect(contains).toEqual(false)
  })
})

describe('chooseUsersFromGroups', () => {
  test('should return one reviewer from each group, excluding the owner', () => {
    // GIVEN
    const owner = 'owner'
    const reviewers = {
      groupA: [
        'owner',
        'reviewer1'
      ],
      groupB: [
        'reviewer2'
      ]
    }
    const numberOfReviewers = 1

    // WHEN
    const list = chooseUsersFromGroups(owner, reviewers, numberOfReviewers)

    // THEN
    expect(list).toEqual(['reviewer1', 'reviewer2'])
  })

  test('should return one reviewer from each group, including the owner if the owner is the only member of a group', () => {
    // GIVEN
    const owner = 'owner'
    const reviewers = {
      groupA: [
        'owner'
      ],
      groupB: [
        'reviewer2'
      ]
    }
    const numberOfReviewers = 1

    // WHEN
    const list = chooseUsersFromGroups(owner, reviewers, numberOfReviewers)

    // THEN
    expect(list.length).toEqual(1)
    expect(list).toEqual(['reviewer2'])
  })

  test('should randomly select a reviewer from each group', () => {
    // GIVEN
    const owner = 'owner'
    const reviewers = {
      groupA: [
        'owner',
        'groupA-1',
        'groupA-2'
      ],
      groupB: [
        'groupB-1',
        'groupB-2'
      ],
      groupC: [],
      groupD: [
        'groupD-1',
        'groupD-2'
      ]
    }
    const numberOfReviewers = 1

    // WHEN
    const list = chooseUsersFromGroups(owner, reviewers, numberOfReviewers)

    // THEN
    expect(list.length).toEqual(3)
    expect(list[0]).toMatch(/groupA/)
    expect(list[1]).toMatch(/groupB/)
    expect(list[2]).toMatch(/groupD/)
  })

  test('should return the only other reviewer', () => {
    // GIVEN
    const owner = 'owner'
    const reviewers = {
      groupA: [
        'owner',
        'reviewer1'
      ],
      groupB: []
    }
    const numberOfReviewers = 1

    // WHEN
    const list = chooseUsersFromGroups(owner, reviewers, numberOfReviewers)

    // THEN
    expect(list.length).toEqual(1)
    expect(list).toEqual(['reviewer1'])
  })

  test('should return the only other reviewer, even when multiple reviewers are specified', () => {
    // GIVEN
    const owner = 'owner'
    const reviewers = {
      groupA: [],
      groupB: [
        'owner',
        'reviewer1'
      ]
    }
    const numberOfReviewers = 2

    // WHEN
    const list = chooseUsersFromGroups(owner, reviewers, numberOfReviewers)

    // THEN
    expect(list.length).toEqual(1)
    expect(list).toEqual(['reviewer1'])
  })

  test('should return an empty list', () => {
    // GIVEN
    const owner = 'owner'
    const reviewers = {
      groupA: [],
      groupB: []
    }
    const numberOfReviewers = 2

    // WHEN
    const list = chooseUsersFromGroups(owner, reviewers, numberOfReviewers)

    // THEN
    expect(list.length).toEqual(0)
    expect(list).toEqual([])
  })
})

describe('fetchConfigurationFile', () => {
  test('fetchs the configuration file', async () => {
    const client = new github.GitHub('token')

    client.repos = {
      getContents: jest.fn().mockImplementation(async () => ({
        data: {
          content: 'IyBTZXQgdG8gdHJ1ZSB0byBhZGQgcmV2aWV3ZXJzIHRvIHB1bGwgcmVxdWVzdHMNCmFkZFJldmlld2VyczogdHJ1ZQ0KDQojIFNldCB0byB0cnVlIHRvIGFkZCBhc3NpZ25lZXMgdG8gcHVsbCByZXF1ZXN0cw0KYWRkQXNzaWduZWVzOiBmYWxzZQ0KDQojIEEgbGlzdCBvZiByZXZpZXdlcnMgdG8gYmUgYWRkZWQgdG8gcHVsbCByZXF1ZXN0cyAoR2l0SHViIHVzZXIgbmFtZSkNCnJldmlld2VyczoNCiAgLSByZXZpZXdlckENCiAgLSByZXZpZXdlckINCiAgLSByZXZpZXdlckM='
        }
      }))
    } as any

    const config = await fetchConfigurationFile(client, {
      owner: 'kentaro-m',
      repo: 'auto-assign-action-test',
      path: '.github/auto_assign',
      ref: 'sha',
    })

    expect(config).toEqual({
      addAssignees: false,
      addReviewers: true,
      reviewers: [
        'reviewerA',
        'reviewerB',
        'reviewerC'
      ]
    })
  })

  test('responds with an error if failure to fetch the configuration file', async () => {
    const client = new github.GitHub('token')

    client.repos = {
      getContents: jest.fn().mockImplementation(async () => ({
        data: {
          content: ''
        }
      }))
    } as any

    expect(fetchConfigurationFile(client, {
        owner: 'kentaro-m',
        repo: 'auto-assign-action-test',
        path: '.github/auto_assign',
        ref: 'sha',
      }))
    .rejects
    .toThrow(/the configuration file is not found/)
  })
})