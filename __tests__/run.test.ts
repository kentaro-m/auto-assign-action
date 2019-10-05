import { mocked } from 'ts-jest/utils'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { run } from '../src/run'
import * as utils from '../src/utils'
import * as handler from '../src/handler'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('../src/utils')
jest.mock('../src/handler')

const mockedUtils = mocked(utils)
const coreMocked = mocked(core)
const mockedHandler = mocked(handler)

describe.only('run', () => {
  beforeEach(() => {
    // @ts-ignore
    github.context = {
      eventName: '',
      workflow: '',
      action: '',
      actor: '',
      payload: {
        action: 'opened',
        number: '1',
        pull_request: {
          number: 1,
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
    }
  })

  test('succeeds the process', async () => {
    coreMocked.getInput.mockImplementation(name => {
      switch (name) {
        case 'repo-token':
          return 'token'
        case 'configuration-path':
          return '.github/auto_assign.yml'
      }
    })

    mockedUtils.fetchConfigurationFile.mockImplementation(async () => ({
      addAssignees: false,
      addReviewers: true,
      reviewers: ['reviewerA', 'reviewerB', 'reviewerC'],
    }))

    mockedHandler.handlePullRequest.mockImplementation(async () => {})

    await run()

    expect(mockedHandler.handlePullRequest).toBeCalled()
  })
})
