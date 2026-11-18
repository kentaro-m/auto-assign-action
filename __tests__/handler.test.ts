import * as github from '@actions/github'
import * as core from '@actions/core'
import { Context } from '@actions/github/lib/context'
import * as handler from '../src/handler'

jest.mock('@actions/core')
jest.mock('@actions/github')

describe('handlePullRequest', () => {
  let context: Context

  beforeEach(async () => {
    context = {
      eventName: '',
      workflow: '',
      action: '',
      actor: '',
      payload: {
        action: 'opened',
        number: '1',
        pull_request: {
          number: 1,
          labels: [],
          title: 'test',
          user: {
            login: 'pr-creator',
          },
        },
        repository: {
          name: 'auto-assign',
          owner: {
            login: 'kentaro-m',
          },
        },
      },
      repo: {
        owner: 'kentaro-m',
        repo: 'auto-assign',
      },
      issue: {
        owner: 'kentaro-m',
        repo: 'auto-assign',
        number: 1,
      },
      sha: '',
      ref: '',
    } as unknown as Context
  })

  test('responds with an error if the webhook payload is not exist', async () => {
    delete context.payload.pull_request

    const client = github.getOctokit('token')
    const config = {
      addAssignees: true,
      addReviewers: true,
      numberOfReviewers: 0,
      reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
      skipKeywords: ['wip'],
    } as any

    expect(handler.handlePullRequest(client, context, config)).rejects.toThrow(
      'the webhook payload is not exist'
    )
  })

  test('exits the process if pull requests include skip words in the title', async () => {
    const spy = jest.spyOn(core, 'info')

    context.payload.pull_request!.title = 'wip test'

    const client = github.getOctokit('token')
    const config = {
      addAssignees: true,
      addReviewers: true,
      numberOfReviewers: 0,
      reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
      skipKeywords: ['wip'],
    } as any

    await handler.handlePullRequest(client, context, config)

    expect(spy.mock.calls[0][0]).toEqual(
      'Skips the process to add reviewers/assignees since PR title includes skip-keywords'
    )
  })

  test.each`
    runOnDraft
    ${true}
    ${false}
  `('skips drafts', async ({ runOnDraft }) => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const spy = jest.spyOn(core, 'info')

    context.payload.pull_request!.draft = true

    const client = github.getOctokit('token')
    const config = {
      addAssignees: true,
      addReviewers: true,
      numberOfReviewers: 0,
      reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
      skipKeywords: ['wip'],
      runOnDraft,
    } as any

    await handler.handlePullRequest(client, context, config)
    runOnDraft
      ? expect(spy.mock.calls[0][0]).not.toEqual(
          'Skips the process to add reviewers/assignees since PR type is draft'
        )
      : expect(spy.mock.calls[0][0]).toEqual(
          'Skips the process to add reviewers/assignees since PR type is draft'
        )
  })

  test('adds reviewers to pull requests if the configuration is enabled, but no assignees', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const config = {
      addAssignees: false,
      addReviewers: true,
      numberOfReviewers: 0,
      reviewers: ['reviewer1', 'reviewer2', 'reviewer3', 'pr-creator'],
      skipKeywords: ['wip'],
    } as any

    const client = github.getOctokit('token')

    const addAssigneesSpy = jest.spyOn(client.rest.issues, 'addAssignees')
    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    await handler.handlePullRequest(client, context, config)

    expect(addAssigneesSpy).not.toBeCalled()
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers).toHaveLength(3)
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers![0]).toMatch(
      /reviewer/
    )
  })

  test('adds pr-creator as assignee if addAssignees is set to author', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const client = github.getOctokit('token')

    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )
    const addAssigneesSpy = jest.spyOn(client.rest.issues, 'addAssignees')

    // GIVEN
    const config = {
      addAssignees: 'author',
    } as any

    // WHEN
    await handler.handlePullRequest(client, context, config)

    // THEN
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees).toHaveLength(1)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![0]).toMatch(
      'pr-creator'
    )
    expect(requestReviewersSpy).not.toBeCalled()
  })

  test('responds with error if addAssignees is not set to boolean or author', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const spy = jest.spyOn(core, 'warning')

    const client = github.getOctokit('token')

    // GIVEN
    const config = {
      addAssignees: 'test',
    } as any

    await handler.handlePullRequest(client, context, config)

    expect(spy.mock.calls[0][0]).toEqual(
      "Error in configuration file to do with using addAssignees. Expected 'addAssignees' variable to be either boolean or 'author'"
    )
  })

  test('adds reviewers to assignees to pull requests if the configuration is enabled ', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const config = {
      addAssignees: true,
      addReviewers: false,
      numberOfReviewers: 0,
      reviewers: ['reviewer1', 'reviewer2', 'reviewer3', 'pr-creator'],
      skipKeywords: ['wip'],
    } as any

    const client = github.getOctokit('token')

    const addAssigneesSpy = jest.spyOn(client.rest.issues, 'addAssignees')
    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    await handler.handlePullRequest(client, context, config)

    expect(addAssigneesSpy.mock.calls[0][0]?.assignees).toHaveLength(3)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![0]).toMatch(/reviewer/)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees).toEqual(
      expect.arrayContaining(['reviewer1', 'reviewer2', 'reviewer3'])
    )
    expect(requestReviewersSpy).not.toBeCalled()
  })

  test('adds assignees to pull requests if the assigness are enabled explicitly', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const config = {
      addAssignees: true,
      addReviewers: false,
      assignees: ['assignee1', 'pr-creator'],
      numberOfAssignees: 2,
      numberOfReviewers: 0,
      reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
      skipKeywords: ['wip'],
    } as any

    const client = github.getOctokit('token')

    const addAssigneesSpy = jest.spyOn(client.rest.issues, 'addAssignees')
    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    await handler.handlePullRequest(client, context, config)

    expect(addAssigneesSpy.mock.calls[0][0]?.assignees).toHaveLength(1)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees).toEqual(
      expect.arrayContaining(['assignee1'])
    )
    expect(requestReviewersSpy).not.toBeCalled()
  })

  test('adds assignees to pull requests using the numberOfReviewers when numberOfAssignees is unspecified', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const config = {
      addAssignees: true,
      addReviewers: true,
      assignees: ['assignee1', 'assignee2', 'assignee3'],
      numberOfReviewers: 2,
      reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
      skipKeywords: ['wip'],
    } as any

    const client = github.getOctokit('token')

    const addAssigneesSpy = jest.spyOn(client.rest.issues, 'addAssignees')
    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    await handler.handlePullRequest(client, context, config)

    expect(addAssigneesSpy.mock.calls[0][0]?.assignees).toHaveLength(2)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![0]).toMatch(/assignee/)
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers).toHaveLength(2)
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers![0]).toMatch(
      /reviewer/
    )
  })

  test("doesn't add assignees if the reviewers contain only a pr creator and assignees are not explicit", async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const config = {
      addAssignees: true,
      addReviewers: true,
      numberOfReviewers: 0,
      reviewers: ['pr-creator'],
      skipKeywords: ['wip'],
    } as any

    const client = github.getOctokit('token')

    const addAssigneesSpy = jest.spyOn(client.rest.issues, 'addAssignees')
    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    await handler.handlePullRequest(client, context, config)

    expect(addAssigneesSpy).not.toHaveBeenCalled()
    expect(requestReviewersSpy).not.toHaveBeenCalled()
  })

  test('adds assignees to pull requests if throws error to add reviewers', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {
            throw new Error(
              'Review cannot be requested from pull request author.'
            )
          },
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const config = {
      addAssignees: true,
      addReviewers: true,
      assignees: ['maintainerX', 'maintainerY'],
      numberOfReviewers: 0,
      reviewers: ['reviewerA', 'reviewerB'],
      skipKeywords: ['wip'],
    } as any

    const client = github.getOctokit('token')

    const spy = jest.spyOn(client.rest.issues, 'addAssignees')

    await handler.handlePullRequest(client, context, config)

    expect(spy.mock.calls[0][0]?.assignees).toHaveLength(2)
    expect(spy.mock.calls[0][0]?.assignees![0]).toMatch(/maintainer/)
  })

  test('adds reviewers to pull requests if throws error to add assignees', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {
            throw new Error('failed to add assignees.')
          },
        },
      },
    }))

    const config = {
      addAssignees: true,
      addReviewers: true,
      assignees: ['maintainerX', 'maintainerY'],
      numberOfReviewers: 0,
      reviewers: ['reviewerA', 'reviewerB'],
      skipKeywords: ['wip'],
    } as any

    const client = github.getOctokit('token')

    const spy = jest.spyOn(client.rest.pulls, 'requestReviewers')

    await handler.handlePullRequest(client, context, config)

    expect(spy.mock.calls[0][0]?.reviewers).toHaveLength(2)
    expect(spy.mock.calls[0][0]?.reviewers![0]).toMatch(/reviewer/)
  })

  /*
   * If 'useReviewGroups' == true, then use the 'groups' object to select reviewers and assignees.
   * The new functionality will still decide to add reviewers and assignees based on the 'addReviewers'
   * and 'addAssignees' flags.
   *
   * Use Cases for group reviews:
   * - if the groups are not present or an empty list, then use normal reviewer functionality
   * - if 'addReviewers' == true
   *   - if #reviewers is 0, follow default behavior (add all users to review)
   *   - if #reviewers is > 0, select #reviewers randomly (exclude self) from each group
   *     + if #peopleInGroup is < #reviewers, select all people in that group to review
   *
   * - if 'addAssignees' == true
   *   - var assignees = #reviewers || #assignees
   *   - if assignees is 0, follow default behavior (add all users to review)
   *   - if assignees is > 0, select assignees randomly (exclude self) from each group
   *     - if #peopleInGroup is < assignees, select all people in that group to be assignees
   */
  test('responds with the error if review groups are enabled, but no reviewGroups variable is defined in configuration', () => {
    // GIVEN
    const config = {
      useReviewGroups: true,
    } as any

    const client = github.getOctokit('token')

    // THEN
    expect(
      handler.handlePullRequest(client, context, config)
    ).rejects.toThrowError(
      new Error(
        "Error in configuration file to do with using review groups. Expected 'reviewGroups' variable to be set because the variable 'useReviewGroups' = true."
      )
    )
  })

  test('responds with the error if assignee groups are enabled, but no assigneeGroups variable is defined in configuration', async () => {
    // GIVEN
    const config = {
      useAssigneeGroups: true,
    } as any

    const client = github.getOctokit('token')

    // THEN
    expect(
      handler.handlePullRequest(client, context, config)
    ).rejects.toThrowError(
      new Error(
        "Error in configuration file to do with using review groups. Expected 'assigneeGroups' variable to be set because the variable 'useAssigneeGroups' = true."
      )
    )
  })

  test('adds reviewers to pull request from reviewers if groups are enabled and empty', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const client = github.getOctokit('token')

    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    const addAssigneesSpy = jest.spyOn(client.rest.issues, 'addAssignees')

    // GIVEN
    const config = {
      addAssignees: false,
      addReviewers: true,
      useReviewGroups: true,
      numberOfReviewers: 1,
      reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
      reviewGroups: [],
    } as any

    // WHEN
    await handler.handlePullRequest(client, context, config)

    // THEN
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers).toHaveLength(1)
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers![0]).toMatch(
      /reviewer/
    )
    expect(addAssigneesSpy).not.toBeCalled()
  })

  test('adds reviewers to pull request from two different groups if review groups are enabled', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const client = github.getOctokit('token')

    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    const addAssigneesSpy = jest.spyOn(client.rest.issues, 'addAssignees')

    // GIVEN
    const config = {
      addAssignees: false,
      addReviewers: true,
      useReviewGroups: true,
      numberOfReviewers: 1,
      reviewGroups: {
        groupA: ['group1-user1', 'group1-user2', 'group1-user3'],
        groupB: ['group2-user1', 'group2-user2', 'group2-user3'],
      },
    } as any

    // WHEN
    await handler.handlePullRequest(client, context, config)

    // THEN
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers).toHaveLength(2)
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers![0]).toMatch(
      /group1/
    )
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers![1]).toMatch(
      /group2/
    )
    expect(addAssigneesSpy).not.toBeCalled()
  })

  test('adds all reviewers from a group that has less members than the number of reviews requested', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const client = github.getOctokit('token')

    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    const addAssigneesSpy = jest.spyOn(client.rest.issues, 'addAssignees')

    // GIVEN
    const config = {
      addAssignees: false,
      addReviewers: true,
      useReviewGroups: true,
      numberOfReviewers: 2,
      reviewGroups: {
        groupA: ['group1-user1', 'group1-user2', 'group1-user3'],
        groupB: ['group2-user1'],
      },
    } as any

    // WHEN
    await handler.handlePullRequest(client, context, config)

    // THEN
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers).toHaveLength(3)
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers![0]).toMatch(
      /group1/
    )
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers![1]).toMatch(
      /group1/
    )
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers![2]).toMatch(
      /group2-user1/
    )
    expect(addAssigneesSpy).not.toBeCalled()
  })

  test('adds assignees to pull request from two different groups if groups are enabled and number of assignees is specified', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const client = github.getOctokit('token')

    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    const addAssigneesSpy = jest.spyOn(client.rest.issues, 'addAssignees')

    // GIVEN
    const config = {
      addAssignees: true,
      addReviewers: false,
      useAssigneeGroups: true,
      numberOfAssignees: 1,
      numberOfReviewers: 2,
      reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
      assigneeGroups: {
        groupA: ['group1-user1', 'group1-user2', 'group1-user3'],
        groupB: ['group2-user1'],
        groupC: ['group3-user1', 'group3-user2', 'group3-user3'],
      },
    } as any

    // WHEN
    await handler.handlePullRequest(client, context, config)

    // THEN
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees).toHaveLength(3)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![0]).toMatch(/group1/)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![1]).toMatch(/group2/)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![2]).toMatch(/group3/)
    expect(requestReviewersSpy).not.toBeCalled()
  })

  test('adds assignees to pull request from two different groups using numberOfReviewers if groups are enabled and number of assignees is not specified', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const client = github.getOctokit('token')

    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    const addAssigneesSpy = jest.spyOn(client.rest.issues, 'addAssignees')

    // GIVEN
    const config = {
      addAssignees: true,
      addReviewers: false,
      useAssigneeGroups: true,
      numberOfReviewers: 1,
      reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
      assigneeGroups: {
        groupA: ['group1-user1', 'group1-user2', 'group1-user3'],
        groupB: ['group2-user1'],
        groupC: ['group3-user1', 'group3-user2', 'group3-user3'],
      },
    } as any

    // WHEN
    await handler.handlePullRequest(client, context, config)

    // THEN
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees).toHaveLength(3)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![0]).toMatch(/group1/)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![1]).toMatch(/group2/)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![2]).toMatch(/group3/)
    expect(requestReviewersSpy).not.toBeCalled()
  })

  test('adds assignees to pull request from two different groups and reviewers are not specified', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const client = github.getOctokit('token')

    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    const addAssigneesSpy = jest.spyOn(client.rest.issues, 'addAssignees')

    // GIVEN
    const config = {
      addAssignees: true,
      addReviewers: false,
      useAssigneeGroups: true,
      numberOfAssignees: 1,
      numberOfReviewers: 2,
      assigneeGroups: {
        groupA: ['group1-user1', 'group1-user2', 'group1-user3'],
        groupB: ['group2-user1'],
        groupC: ['group3-user1', 'group3-user2', 'group3-user3'],
      },
    } as any

    // WHEN
    await handler.handlePullRequest(client, context, config)

    // THEN
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees).toHaveLength(3)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![0]).toMatch(/group1/)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![1]).toMatch(/group2/)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![2]).toMatch(/group3/)
    expect(requestReviewersSpy).not.toBeCalled()
  })

  test('adds normal reviewers and assignees from groups into the pull request', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const client = github.getOctokit('token')

    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    const addAssigneesSpy = jest.spyOn(client.rest.issues, 'addAssignees')

    // GIVEN
    const config = {
      addAssignees: true,
      addReviewers: true,
      useAssigneeGroups: true,
      numberOfAssignees: 1,
      numberOfReviewers: 2,
      reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
      assigneeGroups: {
        groupA: ['group1-user1', 'group1-user2', 'group1-user3'],
        groupB: ['group2-user1'],
        groupC: ['group3-user1', 'group3-user2', 'group3-user3'],
      },
    } as any

    // WHEN
    await handler.handlePullRequest(client, context, config)

    // THEN
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees).toHaveLength(3)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![0]).toMatch(/group1/)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![1]).toMatch(/group2/)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![2]).toMatch(/group3/)

    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers).toHaveLength(2)
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers![0]).toMatch(
      /reviewer/
    )
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers![1]).toMatch(
      /reviewer/
    )
  })

  test('adds normal assignees and reviewers from groups into the pull request', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const client = github.getOctokit('token')

    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    const addAssigneesSpy = jest.spyOn(client.rest.issues, 'addAssignees')

    // GIVEN
    const config = {
      addAssignees: true,
      addReviewers: true,
      useReviewGroups: true,
      numberOfAssignees: 1,
      numberOfReviewers: 2,
      assignees: ['assignee1', 'assignee2', 'assignee3'],
      reviewGroups: {
        groupA: ['group1-reviewer1', 'group1-reviewer2', 'group1-reviewer3'],
        groupB: ['group2-reviewer1'],
        groupC: ['group3-reviewer1', 'group3-reviewer2', 'group3-reviewer3'],
      },
    } as any

    // WHEN
    await handler.handlePullRequest(client, context, config)

    // THEN
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees).toHaveLength(1)
    expect(addAssigneesSpy.mock.calls[0][0]?.assignees![0]).toMatch(/assignee/)

    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers).toHaveLength(5)
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers![0]).toMatch(
      /group1-reviewer/
    )
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers![2]).toMatch(
      /group2-reviewer/
    )
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers![3]).toMatch(
      /group3-reviewer/
    )
  })

  test('skips pull requests that do not have any of the filterLabels.include labels', async () => {
    const spy = jest.spyOn(core, 'info')

    const client = github.getOctokit('token')
    const config = {
      filterLabels: { include: ['test_label'] },
    } as any

    context.payload.pull_request!.labels = [{ name: 'some_label' }]

    await handler.handlePullRequest(client, context, config)

    expect(spy.mock.calls[0][0]).toEqual(
      'Skips the process to add reviewers/assignees since PR is not tagged with any of the filterLabels.include'
    )
  })

  test('skips pull requests that have any of the filterLabels.exclude labels', async () => {
    const spy = jest.spyOn(core, 'info')

    const client = github.getOctokit('token')
    const config = {
      filterLabels: { include: ['test_label'], exclude: ['wip'] },
    } as any

    context.payload.pull_request!.labels = [
      { name: 'test_label' },
      { name: 'wip' },
    ]

    await handler.handlePullRequest(client, context, config)

    expect(spy.mock.calls[0][0]).toEqual(
      'Skips the process to add reviewers/assignees since PR is tagged with any of the filterLabels.exclude'
    )
  })

  test('adds reviewers to the pull request when it has any of the configured labels', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const config = {
      addAssignees: false,
      addReviewers: true,
      filterLabels: { include: ['some_label', 'another_label'] },
      numberOfReviewers: 0,
      reviewers: ['reviewer1', 'reviewer2', 'reviewer3', 'pr-creator'],
    } as any

    context.payload.pull_request!.labels = [{ name: 'some_label' }]

    const client = github.getOctokit('token')

    const addAssigneesSpy = jest.spyOn(client.rest.issues, 'addAssignees')
    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    await handler.handlePullRequest(client, context, config)

    expect(addAssigneesSpy).not.toBeCalled()
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers).toHaveLength(3)
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers![0]).toMatch(
      /reviewer/
    )
  })

  test('adds team reviewers to pull requests if the configuration is enabled', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const client = github.getOctokit('token')

    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    // GIVEN
    const config = {
      addReviewers: true,
      addAssignees: false,
      numberOfReviewers: 0,
      numberOfTeamReviewers: 0,
      numberOfAssignees: 0,
      reviewers: [],
      teamReviewers: ['team1', 'team2', 'team3'],
      assignees: [],
      skipKeywords: [],
      useReviewGroups: false,
      useAssigneeGroups: false,
      useTeamReviewGroups: false,
      reviewGroups: {},
      teamReviewGroups: {},
      assigneeGroups: {},
    }

    // WHEN
    await handler.handlePullRequest(client, context, config)

    // THEN
    expect(requestReviewersSpy).toHaveBeenCalled()
    expect(requestReviewersSpy.mock.calls[0][0]?.team_reviewers).toHaveLength(3)
    expect(requestReviewersSpy.mock.calls[0][0]?.team_reviewers![0]).toMatch(
      /team/
    )
  })

  test('adds both individual and team reviewers to pull requests', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const client = github.getOctokit('token')

    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    // GIVEN
    const config = {
      addReviewers: true,
      addAssignees: false,
      numberOfReviewers: 1,
      numberOfTeamReviewers: 1,
      numberOfAssignees: 0,
      reviewers: ['reviewer1', 'reviewer2'],
      teamReviewers: ['team1', 'team2'],
      assignees: [],
      skipKeywords: [],
      useReviewGroups: false,
      useAssigneeGroups: false,
      useTeamReviewGroups: false,
      reviewGroups: {},
      teamReviewGroups: {},
      assigneeGroups: {},
    }

    // WHEN
    await handler.handlePullRequest(client, context, config)

    // THEN
    expect(requestReviewersSpy).toHaveBeenCalled()
    expect(requestReviewersSpy.mock.calls[0][0]?.reviewers).toHaveLength(1)
    expect(requestReviewersSpy.mock.calls[0][0]?.team_reviewers).toHaveLength(1)
  })

  test('uses team review groups when enabled', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const client = github.getOctokit('token')

    const requestReviewersSpy = jest.spyOn(
      client.rest.pulls,
      'requestReviewers'
    )

    // GIVEN
    const config = {
      addReviewers: true,
      addAssignees: false,
      numberOfReviewers: 0,
      numberOfTeamReviewers: 1,
      numberOfAssignees: 0,
      reviewers: [],
      teamReviewers: [],
      assignees: [],
      skipKeywords: [],
      useReviewGroups: false,
      useAssigneeGroups: false,
      useTeamReviewGroups: true,
      reviewGroups: {},
      teamReviewGroups: {
        frontend: ['frontend-team'],
        backend: ['backend-team'],
      },
      assigneeGroups: {},
    }

    // WHEN
    await handler.handlePullRequest(client, context, config)

    // THEN
    expect(requestReviewersSpy).toHaveBeenCalled()
    expect(requestReviewersSpy.mock.calls[0][0]?.team_reviewers).toHaveLength(2)
  })

  test('throws error when useTeamReviewGroups is true but teamReviewGroups is not set', async () => {
    // MOCKS
    ;(github.getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        pulls: {
          requestReviewers: async () => {},
        },
        issues: {
          addAssignees: async () => {},
        },
      },
    }))

    const client = github.getOctokit('token')

    // GIVEN
    const config = {
      addReviewers: true,
      addAssignees: false,
      numberOfReviewers: 0,
      numberOfTeamReviewers: 1,
      numberOfAssignees: 0,
      reviewers: [],
      teamReviewers: [],
      assignees: [],
      skipKeywords: [],
      useReviewGroups: false,
      useAssigneeGroups: false,
      useTeamReviewGroups: true,
      reviewGroups: {},
      assigneeGroups: {},
    } as any

    // WHEN & THEN
    await expect(
      handler.handlePullRequest(client, context, config)
    ).rejects.toThrowError(
      "Error in configuration file to do with using team review groups. Expected 'teamReviewGroups' variable to be set because the variable 'useTeamReviewGroups' = true."
    )
  })
})
