import { paginate, graphDownload, graphFetch } from './graph-client'
<<<<<<< Updated upstream
import { parseDocument } from './document-parser'
=======
import { parseMicrosoftDoc } from './utils/parser'
>>>>>>> Stashed changes

export async function listOneDriveDocs(connectionId: string, orgId: string, itemId: string = 'root') {
  const items: any[] = []
  const endpoint = itemId === 'root' 
    ? `/me/drive/root/children` 
    : `/me/drive/items/${itemId}/children`
    
  for await (const item of paginate(connectionId, orgId, endpoint)) {
    if (item.file) {
      items.push(item)
    } else if (item.folder) {
      const children = await listOneDriveDocs(connectionId, orgId, item.id)
      items.push(...children)
    }
  }
  return items
}

export async function fetchOneDriveDocContent(connectionId: string, orgId: string, itemId: string): Promise<string> {
  // 1. Get metadata
  const item = await graphFetch(connectionId, orgId, `/me/drive/items/${itemId}`)
  const fileName = item.name.toLowerCase()
  
  // 2. Download content
  const arrayBuffer = await graphDownload(connectionId, orgId, `/me/drive/items/${itemId}/content`)
  const buffer = Buffer.from(arrayBuffer)
  
<<<<<<< Updated upstream
  return parseDocument(fileName, buffer)
=======
  return parseMicrosoftDoc(buffer, fileName)
>>>>>>> Stashed changes
}

/**
 * Fetches the assigned permissions for a specific OneDrive item.
 */
export async function getOneDriveItemPermissions(connectionId: string, orgId: string, itemId: string) {
  const data = await graphFetch(connectionId, orgId, `/me/drive/items/${itemId}/permissions`)
  return data.value
}
