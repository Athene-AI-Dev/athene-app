import { githubFetch } from './client';
import { FetchedChunk } from '../types';
import { indexDocument } from '../indexer';

const PRS_QUERY = `
  query GetPRs($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequests(first: 50, after: $cursor, states: [OPEN, MERGED, CLOSED]) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          body
          url
          createdAt
          reviews(first: 50) {
            nodes {
              body
            }
          }
        }
      }
    }
  }
`;

export async function githubPrsFetcher(connectionId: string, orgId: string, owner: string, repo: string): Promise<FetchedChunk[]> {
  const chunks: FetchedChunk[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const data: any = await githubFetch(connectionId, orgId, PRS_QUERY, { owner, repo, cursor });
    
    const prsResult = data.data?.repository?.pullRequests;
    if (!prsResult) break;

    for (const pr of prsResult.nodes) {
      const allReviews = pr.reviews?.nodes?.map((r: any) => r.body).filter(Boolean).join('\n---\n') || '';
      const fullContent = `Pull Request: ${pr.title}\n\n${pr.body}\n\nReviews:\n${allReviews}`;
      
      const chunk: FetchedChunk = {
        id: pr.id,
        title: pr.title,
        content: fullContent,
        url: pr.url,
        provider: 'github',
        type: 'pull_request',
        createdAt: pr.createdAt,
        metadata: { owner, repo }
      };
      
      chunks.push(chunk);
      await indexDocument(chunk);
    }
    
    hasNextPage = prsResult.pageInfo.hasNextPage;
    cursor = prsResult.pageInfo.endCursor;
  }

  return chunks;
}
