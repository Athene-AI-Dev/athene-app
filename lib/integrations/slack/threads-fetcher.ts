import { slackFetch } from './client'

export async function fetchThreadReplies(
  connectionId: string,
  orgId: string,
  channelId: string,
  threadTs: string
): Promise<string> {
  const replies = await slackFetch<any>(connectionId, orgId, 'conversations.replies', {
    channel: channelId,
    ts: threadTs,
    limit: '100',
  })
  return replies.messages
    .slice(1)
    .map((r: any) => ` → ${r.text}`)
    .join('\n')
}
