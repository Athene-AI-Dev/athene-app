// TODO: Implement morning briefing worker (ATH-30).
// Should use microsoftFetcher to pull unread emails + today's calendar events,
// format a briefing summary via LLM, and push to the user's notification feed.
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId, orgId } = await auth()
  
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  return NextResponse.json({ 
    status: 'ok',
    userId,
    orgId
  })
}
