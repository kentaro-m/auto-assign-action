const core = require('@actions/core')
const github = require('@actions/github')

async function run() {
	const token = core.getInput('github_token')
  const rawTeams = core.getInput('teams')
  const teamNames = rawTeams.split(',')

	const octokit = github.getOctokit(token)
	const context = github.context

	if (context.payload.pull_request == null) {
		core.setFailed('No pull request found.')
		return
	}

	const org = context.repo.owner
	const authorName = context.payload.pull_request.user.login
	const pullRequestNumber = context.payload.pull_request.number

	const authorTeams = []
	for await (const teamName of teamNames) {
		const { data: teamMembers } = await octokit.rest.teams.listMembersInOrg({
			org,
			team_slug: teamName,
		})
		if (teamMembers.find(member => member.login === authorName)) {
			authorTeams.push(teamName)
		}
	}

	await octokit.rest.issues.addAssignees({
		...context.repo,
		issue_number: pullRequestNumber,
		assignees: [authorName],
	})
	console.log(`Added assignee: ${authorName}`)

	if (authorTeams.length > 0) {
		await octokit.rest.pulls.requestReviewers({
			...context.repo,
			pull_number: pullRequestNumber,
			team_reviewers: authorTeams,
		})
		console.log(`Added team reviewer(s): ${authorTeams.join(', ')}`)
	}
}

run()
