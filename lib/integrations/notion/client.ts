import { getToken } from '@/lib/nango/client'

export async function notionFetch(connectionId: string, path: string, body?: object, retryCount = 0): Promise<any> {
  const token = await getToken(connectionId, 'notion')
  
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })

  if (response.status === 429 && retryCount < 3) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10)
    console.warn(`[Notion API] Rate limited. Retrying after ${retryAfter}s...`)
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
    return notionFetch(connectionId, path, body, retryCount + 1)
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Notion API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
  }

  return response.json()
}
