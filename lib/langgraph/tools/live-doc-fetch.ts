import { githubIssuesFetcher } from '../../integrations/github/issues-fetcher';
import { githubPrsFetcher } from '../../integrations/github/prs-fetcher';
import { githubWikiFetcher } from '../../integrations/github/wiki-fetcher';

import { linearIssuesFetcher } from '../../integrations/linear/issues-fetcher';
import { linearProjectsFetcher } from '../../integrations/linear/projects-fetcher';
import { linearCyclesFetcher } from '../../integrations/linear/cycles-fetcher';

import { FetchedChunk } from '../../integrations/types';

type FetcherFunction = (connectionId: string, orgId: string, ...args: any[]) => Promise<FetchedChunk[]>;

const providers: Record<string, FetcherFunction> = {};

export function registerProvider(name: string, fetcher: FetcherFunction) {
  providers[name] = fetcher;
}

// Wrapper for github to fetch all 3
export async function githubFetcher(connectionId: string, orgId: string, owner: string, repo: string): Promise<FetchedChunk[]> {
  const issues = await githubIssuesFetcher(connectionId, orgId, owner, repo);
  const prs = await githubPrsFetcher(connectionId, orgId, owner, repo);
  const wiki = await githubWikiFetcher(connectionId, orgId, owner, repo);
  return [...issues, ...prs, ...wiki];
}

// Wrapper for linear to fetch all 3
export async function linearFetcher(connectionId: string, orgId: string): Promise<FetchedChunk[]> {
  const issues = await linearIssuesFetcher(connectionId, orgId);
  const projects = await linearProjectsFetcher(connectionId, orgId);
  const cycles = await linearCyclesFetcher(connectionId, orgId);
  return [...issues, ...projects, ...cycles];
}

// Register providers
registerProvider('github', githubFetcher);
registerProvider('linear', linearFetcher);

export async function fetchDocumentChunks(provider: string, connectionId: string, orgId: string, ...args: any[]): Promise<FetchedChunk[]> {
  const fetcher = providers[provider];
  if (!fetcher) throw new Error(`Provider ${provider} not found`);
  return fetcher(connectionId, orgId, ...args);
}
