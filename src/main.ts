import * as core from '@actions/core'
import * as github from '@actions/github'
import * as yaml from 'js-yaml'
import { Context } from '@actions/github/lib/context'
import { includesSkipKeywords } from './utils'
import AutoAssign from './auto_assign'

async function run() {
  try {
    const token = core.getInput('repo-token', { required: true })
    const client = new github.GitHub(token)
    const configPath = core.getInput('configuration-path', { required: true })
    const context = github.context
    await handlePullRequest(client, context, configPath)
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function handlePullRequest(client: github.GitHub, context: Context, configPath: string) {
  const result = await client.repos.getContents({
    owner: context.repo.owner,
    repo: context.repo.repo,
    path: configPath,
    ref: context.sha,
  })

  const data: any = result.data

  if (!data.content) {
    throw new Error('the configuration file is not found')
  }

  const configString = Buffer.from(data.content, 'base64').toString()
  const config = yaml.safeLoad(configString)

  if (!config) {
    throw new Error('the configuration file failed to load')
  }

  if (!context.payload.pull_request) {
    throw new Error('the webhook payload is not exist')
  }

  const title = context.payload.pull_request.title
  if (config.skipKeywords && includesSkipKeywords(title, config.skipKeywords)) {
    console.log('skips adding reviewers')
    return
  }
  if (context.payload.pull_request.draft) {
    console.log('ignore draft PR')
    return
  }

  if (config.useReviewGroups && !config.reviewGroups) {
    throw new Error(
      "Error in configuration file to do with using review groups. Expected 'reviewGroups' variable to be set because the variable 'useReviewGroups' = true."
    )
  }

  if (config.useAssigneeGroups && !config.assigneeGroups) {
    throw new Error(
      "Error in configuration file to do with using review groups. Expected 'assigneeGroups' variable to be set because the variable 'useAssigneeGroups' = true."
    )
  }

  const autoAssign = new AutoAssign(client, context, config)

  if (config.addReviewers) {
    await autoAssign.addReviewers()
  }

  if (config.addAssignees) {
    await autoAssign.addAssignees()
  }
}

run()