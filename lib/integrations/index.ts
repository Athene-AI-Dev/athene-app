import { ProviderKey } from './providers';
import { githubSearcher } from './github/search';
import { linearSearcher } from './linear/search';
import { FetchedChunk } from './base';
import { githubIssuesFetcher } from './github/issues-fetcher';
import { linearIssuesFetcher } from './linear/issues-fetcher';

export * from './base';
export * from './providers';
export * from './indexing';

// Expose map for search requests
export function getSearcher(provider: ProviderKey | string): ((connectionId: string, orgId: string, query: string, args?: any) => Promise<FetchedChunk[]>) | null {
  if (provider === 'github') return githubSearcher;
  if (provider === 'linear') return linearSearcher;
  return null;
}

// Expose map for simple batched doc fetches
export function getProvider(provider: ProviderKey | string): ((connectionId: string, orgId: string, ...args: any[]) => Promise<FetchedChunk[]>) | null {
  if (provider === 'github') return githubIssuesFetcher as any;
  if (provider === 'linear') return linearIssuesFetcher as any;
  return null;
}
