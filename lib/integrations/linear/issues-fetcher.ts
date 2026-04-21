import { linearFetch } from './client';
import { FetchedChunk } from '../types';
import { indexDocument } from '../indexer';

const ISSUES_QUERY = `
  query GetIssues($cursor: String) {
    issues(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        description
        url
        createdAt
        assignee {
          name
        }
        comments(first: 50) {
          nodes {
            body
          }
        }
      }
    }
  }
`;

export async function linearIssuesFetcher(connectionId: string, orgId: string): Promise<FetchedChunk[]> {
  const chunks: FetchedChunk[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const data: any = await linearFetch(connectionId, orgId, ISSUES_QUERY, { cursor });
    
    const issuesResult = data.data?.issues;
    if (!issuesResult) break;

    for (const issue of issuesResult.nodes) {
      const assigneeName = issue.assignee?.name ? `Assignee: ${issue.assignee.name}` : 'Unassigned';
      const allComments = issue.comments?.nodes?.map((c: any) => c.body).join('\n---\n') || '';
      const fullContent = `Linear Issue: ${issue.title}\n${assigneeName}\n\n${issue.description || ''}\n\nComments:\n${allComments}`;
      
      const chunk: FetchedChunk = {
        id: issue.id,
        title: issue.title,
        content: fullContent,
        url: issue.url,
        provider: 'linear',
        type: 'issue',
        createdAt: issue.createdAt,
      };
      
      chunks.push(chunk);
      await indexDocument(chunk);
    }
    
    hasNextPage = issuesResult.pageInfo.hasNextPage;
    cursor = issuesResult.pageInfo.endCursor;
  }

  return chunks;
}
