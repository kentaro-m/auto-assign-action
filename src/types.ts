import * as github from '@actions/github'

export type Client = ReturnType<typeof github.getOctokit>
