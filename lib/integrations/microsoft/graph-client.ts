import { getToken } from '@/lib/nango/client'

export async function graphFetch(connectionId: string, endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<any> {
  const token = await getToken(connectionId, 'microsoft')
  try {
    const res = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (res.status === 429 && retryCount < 3) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '1', 10)
        console.warn(`[Graph API] Rate limited. Retrying after ${retryAfter}s...`)
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
        return graphFetch(connectionId, endpoint, options, retryCount + 1)
    }

    if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Graph API: ${res.status} ${errorText}`)
    }
    // Return empty object for empty responses (like 204 No Content)
    if (res.status === 204) return {}
    return res.json()
  } finally {
    // token goes out of scope — GC
  }
}

export async function graphDownload(connectionId: string, endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<ArrayBuffer> {
    const token = await getToken(connectionId, 'microsoft')
    const res = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
        ...options,
        headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
        },
    })

    if (res.status === 429 && retryCount < 3) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '1', 10)
        console.warn(`[Graph API Download] Rate limited. Retrying after ${retryAfter}s...`)
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
        return graphDownload(connectionId, endpoint, options, retryCount + 1)
    }

    if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Graph API Download: ${res.status} ${errorText}`)
    }
    return res.arrayBuffer()
}

// Helper for pagination (Graph uses @odata.nextLink)
export async function* paginate(connectionId: string, endpoint: string) {
  let url = endpoint
  while (url) {
    const data = await graphFetch(connectionId, url)
    if (data.value && Array.isArray(data.value)) {
      yield* data.value
    }
    
    if (data['@odata.nextLink']) {
      const nextUrl = new URL(data['@odata.nextLink'])
      url = nextUrl.pathname.replace('/v1.0', '') + nextUrl.search
    } else {
      url = ''
    }
  }
}
