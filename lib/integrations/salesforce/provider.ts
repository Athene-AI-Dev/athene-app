// ============================================================
// Salesforce provider — live-doc-fetch integration (ATH-67)
//
// Registers with the provider registry so that live-doc-fetch
// can retrieve fresh content from Salesforce by external ID.
// ============================================================

import { registerProvider } from '@/lib/langgraph/tools/live-doc-fetch'
import { salesforceFetch }  from './client'

registerProvider('salesforce', async ({ orgId, connectionId, externalId }) => {
  // externalId format: "sf-account-ID" | "sf-opportunity-ID" | "sf-case-ID"
  const parts      = externalId.split('-')
  const objectType = parts[1]
  const sfId       = parts.slice(2).join('-')

  if (!objectType || !sfId) {
    console.warn(`[salesforce-provider] malformed externalId: "${externalId}"`)
    return null
  }

  type SFRecord = Record<string, string | null>
  let record: SFRecord | null = null

  // Note: instanceUrl is not available at live-fetch time — we skip it
  // and let the client fall back to login.salesforce.com. For production
  // orgs the instance URL should be stored in the connection metadata.
  if (objectType === 'account') {
    record = await salesforceFetch(connectionId, `/sobjects/Account/${sfId}?fields=Id,Name,Industry,Description`, orgId) as SFRecord
  } else if (objectType === 'opportunity') {
    record = await salesforceFetch(connectionId, `/sobjects/Opportunity/${sfId}?fields=Id,Name,StageName,Description`, orgId) as SFRecord
  } else if (objectType === 'case') {
    record = await salesforceFetch(connectionId, `/sobjects/Case/${sfId}?fields=Id,Subject,Description,Status`, orgId) as SFRecord
  } else {
    console.warn(`[salesforce-provider] unknown objectType: "${objectType}"`)
    return null
  }

  if (!record) return null

  const title   = record['Name'] ?? record['Subject'] ?? sfId
  const content = Object.entries(record)
    .filter(([k, v]) => k !== 'attributes' && v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  return { content, title }
})