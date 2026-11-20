import { existsSync, readFileSync } from 'fs'
import { EOL } from 'os'
import createClient, { Client as OpenApiClient } from 'openapi-fetch'
import type { components, paths } from './generated/github'

export interface Repository {
  owner: string
  repo: string
}

export interface Issue extends Repository {
  number: number
}

interface RepositoryPayload {
  name: string
  owner: { login: string }
}

export interface PullRequestPayload {
  number: number
  title: string
  draft?: boolean
  changed_files?: number
  user: { login: string }
  labels?: Array<{ name: string }>
}

export interface WebhookPayload {
  action?: string
  number?: number | string
  issue?: { number: number }
  pull_request?: PullRequestPayload
  repository?: RepositoryPayload
  [key: string]: unknown
}

export class Context {
  payload: WebhookPayload = {}
  eventName = process.env.GITHUB_EVENT_NAME
  sha = process.env.GITHUB_SHA
  ref = process.env.GITHUB_REF
  workflow = process.env.GITHUB_WORKFLOW
  action = process.env.GITHUB_ACTION
  actor = process.env.GITHUB_ACTOR
  job = process.env.GITHUB_JOB
  runAttempt = parseInt(process.env.GITHUB_RUN_ATTEMPT || '', 10)
  runNumber = parseInt(process.env.GITHUB_RUN_NUMBER || '', 10)
  runId = parseInt(process.env.GITHUB_RUN_ID || '', 10)
  apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com'
  serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com'
  graphqlUrl =
    process.env.GITHUB_GRAPHQL_URL || 'https://api.github.com/graphql'

  constructor() {
    const eventPath = process.env.GITHUB_EVENT_PATH
    if (eventPath) {
      if (existsSync(eventPath)) {
        this.payload = JSON.parse(readFileSync(eventPath, 'utf8'))
      } else {
        process.stdout.write(
          `GITHUB_EVENT_PATH ${eventPath} does not exist${EOL}`
        )
      }
    }
  }

  get repo(): Repository {
    if (process.env.GITHUB_REPOSITORY) {
      const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
      if (owner && repo) return { owner, repo }
    }
    if (this.payload.repository) {
      return {
        owner: this.payload.repository.owner.login,
        repo: this.payload.repository.name,
      }
    }
    throw new Error(
      "context.repo requires a GITHUB_REPOSITORY environment variable like 'owner/repo'"
    )
  }

  get issue(): Issue {
    const issue =
      this.payload.issue || this.payload.pull_request || this.payload
    return { ...this.repo, number: issue.number as number }
  }
}

export type Client = OpenApiClient<paths>
export type Fetch = (input: Request) => Promise<Response>

interface ClientMetadata {
  baseUrl: string
  fetch: Fetch
  headers: Record<string, string>
}

const clientMetadata = new WeakMap<Client, ClientMetadata>()
export type RepositoryContent =
  | components['schemas']['content-directory']
  | components['schemas']['content-file']
  | components['schemas']['content-symlink']
  | components['schemas']['content-submodule']
export type PullRequestFile = components['schemas']['diff-entry']

export interface RepositoryOptions extends Repository {
  path: string
  ref?: string
}

export interface PullRequestOptions extends Repository {
  pull_number: number
}

export interface RequestReviewersOptions extends PullRequestOptions {
  reviewers: string[]
}

export interface AddAssigneesOptions extends Repository {
  issue_number: number
  assignees: string[]
}

export interface ListFilesOptions extends PullRequestOptions {
  per_page?: number
}

export interface RemoveRequestedReviewersOptions extends PullRequestOptions {
  reviewers: string[]
  team_reviewers?: string[]
}

export interface ApiResponse<T> {
  data: T
  status: number
  headers: Headers
  url: string
}

export class GitHubApiError extends Error {
  readonly status: number
  readonly response: ApiResponse<unknown>

  constructor(message: string, response: ApiResponse<unknown>) {
    super(message)
    this.name = 'GitHubApiError'
    this.status = response.status
    this.response = response
  }
}

function apiErrorMessage(response: Response, error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message)
    const documentationUrl =
      'documentation_url' in error
        ? String((error as { documentation_url: unknown }).documentation_url)
        : ''
    return documentationUrl ? `${message} - ${documentationUrl}` : message
  }
  if (typeof error === 'string' && error) return error
  return `GitHub API request failed: ${response.status} ${response.statusText}`.trim()
}

function unwrap<T>(result: {
  data?: T
  error?: unknown
  response: Response
}): ApiResponse<T> {
  const { data, error, response } = result
  const apiResponse: ApiResponse<unknown> = {
    data: error === undefined ? data : error,
    status: response.status,
    headers: response.headers,
    url: response.url,
  }
  if (error !== undefined || !response.ok) {
    throw new GitHubApiError(apiErrorMessage(response, error), apiResponse)
  }
  return apiResponse as ApiResponse<T>
}

function githubPathSerializer(
  pathname: string,
  pathParams: Record<string, unknown>
): string {
  return Object.entries(pathParams).reduce((path, [name, value]) => {
    const encoded =
      name === 'path'
        ? String(value)
            .split('/')
            .map((segment) => encodeURIComponent(segment))
            .join('/')
        : encodeURIComponent(String(value))
    return path.replace(`{${name}}`, encoded)
  }, pathname)
}

function nextLink(header: string | null): string | undefined {
  if (!header) return undefined
  for (const part of header.split(',')) {
    const match = part.match(/^\s*<([^>]+)>;\s*rel="([^"]+)"/)
    if (match?.[2].split(/\s+/).includes('next')) return match[1]
  }
  return undefined
}

export function getOctokit(
  token: string,
  options: { baseUrl?: string; fetch?: Fetch } = {}
): Client {
  if (!token) throw new Error('Parameter token is required')
  const baseUrl = (
    options.baseUrl ||
    process.env.GITHUB_API_URL ||
    'https://api.github.com'
  ).replace(/\/$/, '')

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'auto-assign-action',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const fetchImpl = options.fetch || globalThis.fetch
  const client = createClient<paths>({
    baseUrl,
    fetch: fetchImpl,
    headers,
    pathSerializer: githubPathSerializer,
  })
  clientMetadata.set(client, { baseUrl, fetch: fetchImpl, headers })
  return client
}

export async function getRepositoryContent(
  client: Client,
  options: RepositoryOptions
): Promise<ApiResponse<RepositoryContent>> {
  const { owner, repo, path, ref } = options
  // The upstream schema's discriminator includes the array-shaped directory
  // response, so openapi-typescript widens one object variant's `type` field.
  return unwrap(
    await client.GET('/repos/{owner}/{repo}/contents/{path}', {
      params: { path: { owner, repo, path }, query: { ref } },
    })
  ) as unknown as ApiResponse<RepositoryContent>
}

export async function requestReviewers(
  client: Client,
  options: RequestReviewersOptions
): Promise<ApiResponse<unknown>> {
  const { owner, repo, pull_number, reviewers } = options
  return unwrap(
    await client.POST(
      '/repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers',
      {
        params: { path: { owner, repo, pull_number } },
        body: { reviewers },
      }
    )
  )
}

export async function listRequestedReviewers(
  client: Client,
  options: PullRequestOptions
): Promise<ApiResponse<components['schemas']['pull-request-review-request']>> {
  const { owner, repo, pull_number } = options

  return unwrap(
    await client.GET(
      '/repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers',
      {
        params: { path: { owner, repo, pull_number } },
      }
    )
  )
}

export async function removeRequestedReviewers(
  client: Client,
  options: RemoveRequestedReviewersOptions
): Promise<ApiResponse<unknown>> {
  const { owner, repo, pull_number, reviewers, team_reviewers } = options

  return unwrap(
    await client.DELETE(
      '/repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers',
      {
        params: { path: { owner, repo, pull_number } },
        body: { reviewers, team_reviewers },
      }
    )
  )
}

export async function addAssignees(
  client: Client,
  options: AddAssigneesOptions
): Promise<ApiResponse<unknown>> {
  const { owner, repo, issue_number, assignees } = options
  return unwrap(
    await client.POST('/repos/{owner}/{repo}/issues/{issue_number}/assignees', {
      params: { path: { owner, repo, issue_number } },
      body: { assignees },
    })
  )
}

async function listFilesPage(
  client: Client,
  options: ListFilesOptions
): Promise<ApiResponse<PullRequestFile[]>> {
  const { owner, repo, pull_number, per_page } = options
  return unwrap(
    await client.GET('/repos/{owner}/{repo}/pulls/{pull_number}/files', {
      params: { path: { owner, repo, pull_number }, query: { per_page } },
    })
  )
}

async function fetchPage(
  client: Client,
  url: URL
): Promise<ApiResponse<PullRequestFile[]>> {
  const metadata = clientMetadata.get(client)
  if (!metadata) throw new Error('GitHub client metadata is unavailable')
  const response = await metadata.fetch(
    new Request(url, { method: 'GET', headers: metadata.headers })
  )
  let data: unknown
  const text = await response.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  return unwrap({
    data: response.ok ? (data as PullRequestFile[]) : undefined,
    error: response.ok ? undefined : data,
    response,
  })
}

export async function listPullRequestFiles(
  client: Client,
  options: ListFilesOptions
): Promise<PullRequestFile[]> {
  const metadata = clientMetadata.get(client)
  if (!metadata) throw new Error('GitHub client metadata is unavailable')
  const results: PullRequestFile[] = []
  let response = await listFilesPage(client, options)
  results.push(...response.data)
  const visited = new Set<string>()
  if (response.url) visited.add(response.url)
  let next = nextLink(response.headers.get('link'))

  while (next) {
    const url = new URL(next, `${metadata.baseUrl}/`)
    if (url.origin !== new URL(metadata.baseUrl).origin) {
      throw new Error(`Refusing to follow pagination link to ${url.origin}`)
    }
    if (visited.has(url.href)) {
      throw new Error(`GitHub API pagination loop detected at ${url.href}`)
    }
    visited.add(url.href)
    response = await fetchPage(client, url)
    results.push(...response.data)
    next = nextLink(response.headers.get('link'))
  }

  return results
}

export const context = new Context()
