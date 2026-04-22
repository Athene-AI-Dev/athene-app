import { getCloudId, atlassianFetch } from '@/lib/integrations/atlassian/client'
import { stripHtml } from '@/lib/integrations/atlassian/confluence-html'

/**
 * Placeholder for indexDocument.
 * Should be imported from the core indexing service in a production environment.
 */
async function indexDocument(data: any) {
  console.log('[Indexing Confluence Page]', data.sourceId, data.metadata.title)
  // TODO: Implement actual indexing logic
}

/**
 * Step 3 — Async tool for bulk indexing Confluence spaces.
 * Processes pages in batches and strips HTML for indexing.
 */
export async function indexConfluenceSpace(
  connectionId: string, 
  spaceKey: string, 
  orgId: string, 
  deptId: string
) {
  const cloudId = await getCloudId(connectionId, orgId, 'confluence')
  let start = 0
  const limit = 25

  while (true) {
    const data = await atlassianFetch(
      connectionId, 
      cloudId,
      `/wiki/rest/api/content?spaceKey=${spaceKey}&expand=body.storage,version,metadata.labels&limit=${limit}&start=${start}`,
      orgId,
      'confluence'
    )
  
    if (!data.results || data.results.length === 0) break

    for (const page of data.results) {
      const htmlContent = page.body?.storage?.value
      const content = stripHtml(htmlContent)  // Confluence stores content as XHTML storage format
      
      const labels = page.metadata?.labels?.results?.map((l: any) => l.name) || []
    
      await indexDocument({
        orgId, 
        deptId,
        sourceType: 'confluence',
        sourceId: page.id,
        sourceUrl: `https://athene-ai.atlassian.net/wiki${page._links.webui}`,
        content,
        metadata: {
          title: page.title,
          last_modified: page.version?.when,
          author: page.version?.by?.displayName,
          labels,
          tags: labels, // Aliased for consistency
          space_key: spaceKey,
        },
        visibility: 'department',
      })
    }
  
    if (!data._links || !data._links.next) break
    start += limit
  }
}
