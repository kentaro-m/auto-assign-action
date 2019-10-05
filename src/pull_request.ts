import * as github from '@actions/github'
import * as core from '@actions/core'
import { Context } from '@actions/github/lib/context'

export async function addReviewers(
  client: github.GitHub,
  context: Context,
  reviewers: string[]
): Promise<void> {
  const result = await client.pulls.createReviewRequest({
    ...context.issue,
    reviewers,
  })
  core.debug(JSON.stringify(result))
}

export async function addAssignees(
  client: github.GitHub,
  context: Context,
  assignees: string[]
): Promise<void> {
  const result = await client.issues.addAssignees({
    ...context.issue,
    assignees,
  })
  core.debug(JSON.stringify(result))
}
