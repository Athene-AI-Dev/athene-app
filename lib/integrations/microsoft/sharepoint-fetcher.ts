import { paginate, graphDownload, graphFetch } from './graph-client'
<<<<<<< Updated upstream
import { parseDocument } from './document-parser'
=======
import { parseMicrosoftDoc } from './utils/parser'
>>>>>>> Stashed changes

export async function listSharePointDocs(connectionId: string, orgId: string, siteId: string, itemId: string = 'root') {
  const items: any[] = []
  const endpoint = itemId === 'root' 
    ? `/sites/${siteId}/drive/root/children` 
    : `/sites/${siteId}/drive/items/${itemId}/children`
    
  for await (const item of paginate(connectionId, orgId, endpoint)) {
    if (item.file) {
      items.push(item)
    } else if (item.folder) {
      // Recurse to find all files in subfolders
      const children = await listSharePointDocs(connectionId, orgId, siteId, item.id)
      items.push(...children)
    }
  }
  return items
}

export async function fetchDocContent(connectionId: string, orgId: string, driveId: string, itemId: string): Promise<string> {
  // 1. Get item metadata to determine file type
  const item = await graphFetch(connectionId, orgId, `/drives/${driveId}/items/${itemId}`)
  const fileName = item.name.toLowerCase()
  
  // 2. Download content
  const arrayBuffer = await graphDownload(connectionId, orgId, `/drives/${driveId}/items/${itemId}/content`)
  const buffer = Buffer.from(arrayBuffer)
  
<<<<<<< Updated upstream
  return parseDocument(fileName, buffer)
=======
  return parseMicrosoftDoc(buffer, fileName)
>>>>>>> Stashed changes
}

/**
 * Fetches the assigned permissions for a specific SharePoint document.
 * This includes who has access (people, groups) and what role they have.
 */
export async function getSharePointItemPermissions(connectionId: string, orgId: string, driveId: string, itemId: string) {
  const data = await graphFetch(connectionId, orgId, `/drives/${driveId}/items/${itemId}/permissions`)
  return data.value // Returns a list of Permission objects
}
