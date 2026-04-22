import { getCloudId, atlassianFetch } from '@/lib/integrations/atlassian/client'
import { extractTextFromADF } from '@/lib/integrations/atlassian/adf-to-text'

/**
 * Placeholder for indexDocument.
 * In a production environment, this would import from a shared indexing utility
 * that handles vector embeddings and database insertion.
 */
async function indexDocument(data: any) {
  console.log('[Indexing Document]', data.sourceId, data.metadata.title)
  // Implementation will follow in subsequent steps or should be imported from the core indexing service.
}

/**
 * Step 2 — Async tool for bulk indexing Jira projects.
 * Runs via QStash worker to process issues in batches.
 */
export async function indexJiraProject(
  connectionId: string, 
  projectKey: string, 
  orgId: string, 
  deptId: string
) {
  const cloudId = await getCloudId(connectionId, orgId)
  let startAt = 0
  const batchSize = 100

  while (true) {
    const data = await atlassianFetch(
      connectionId, 
      cloudId,
      `/rest/api/3/search?jql=project=${projectKey}&fields=summary,description,status,assignee,updated,labels,issuetype,priority&startAt=${startAt}&maxResults=${batchSize}`,
      orgId,
      'jira'
    )
  
    if (!data.issues || data.issues.length === 0) break

    for (const issue of data.issues) {
      const content = [
        issue.fields.summary,
        extractTextFromADF(issue.fields.description),  // Converts Atlassian Document Format to text
      ].filter(Boolean).join('\n\n')
    
      await indexDocument({
        orgId, 
        deptId,
        sourceType: 'jira',
        sourceId: issue.key,  // e.g., PROJ-123
        sourceUrl: `https://athene-ai.atlassian.net/browse/${issue.key}`,
        content,
        metadata: {
          title: issue.fields.summary,
          status: issue.fields.status?.name,
          priority: issue.fields.priority?.name,
          assignee: issue.fields.assignee?.displayName,
          issue_type: issue.fields.issuetype?.name,
          last_modified: issue.fields.updated,
          labels: issue.fields.labels || [],
          tags: issue.fields.labels || [], // Aliased for consistency
          project_key: projectKey,
        },
        visibility: 'department',
      })
    }
  
    if (data.issues.length < batchSize) break
    startAt += batchSize
  }
}

/**
 * Mode B — Live JQL search for real-time lookups.
 * Useful for LangGraph tools to find specific issues during a conversation.
 */
export async function liveJiraSearch(connectionId: string, jql: string, orgId: string) {
  const cloudId = await getCloudId(connectionId, orgId)
  return atlassianFetch(
    connectionId, 
    cloudId, 
    `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=5`,
    orgId,
    'jira'
  )
}
