import { FetchedChunk } from '../base';
import { linearFetch } from './client';

export interface LinearSearchConfig {
  // Empty for now, signature parity 
}

export async function linearSearcher(
  connectionId: string, 
  orgId: string, 
  query: string,
  config?: LinearSearchConfig
): Promise<FetchedChunk[]> {
  // Use GraphQL to filter searchable issues
  const GQL = `
    query SearchIssues($query: String!) {
      issueSearch(query: $query, first: 20) {
        nodes {
          id
          title
          description
          url
          createdAt
        }
      }
    }
  `;

  const data: any = await linearFetch(connectionId, orgId, GQL, { query });
  
  const issues = data.data?.issueSearch?.nodes;
  if (!issues) return [];

  return issues.map((issue: any) => ({
    chunk_id: issue.id,
    title: issue.title,
    content: issue.description || '',
    source_url: issue.url,
    metadata: {
      provider: 'linear',
      resource_type: 'issue',
      created_at: issue.createdAt,
    }
  }));
}
