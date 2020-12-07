import * as core from '@actions/core'
import * as github from '@actions/github'
import * as utils from './utils'
import * as handler from './handler'
import * as yaml from 'js-yaml'

export async function run() {
  try {
    const token = core.getInput('repo-token', { required: true })
    const configContent = core.getInput('configuration', { required: false })
    const configPath = core.getInput('configuration-path', {
      required: true,
    })

    const client = new github.GitHub(token)
    const { repo, sha } = github.context
    const fileConfig = await utils.fetchConfigurationFile(client, {
      owner: repo.owner,
      repo: repo.repo,
      path: configPath,
      ref: sha,
    })

    const config = await utils.mergeConfiguration(fileConfig, configContent)

    await handler.handlePullRequest(client, github.context, config)
  } catch (error) {
    core.setFailed(error.message)
  }
}
