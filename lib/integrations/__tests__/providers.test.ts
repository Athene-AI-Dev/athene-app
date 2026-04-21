import { describe, it, expect } from 'vitest'
import {
  PROVIDER_REGISTRY,
  getProvider,
  getProviderByNangoKey,
  getProvidersByCategory,
  getWriteProviders,
} from '@/lib/integrations/providers'
import type { ProviderKey } from '@/lib/integrations/providers'

describe('Provider Registry', () => {
  it('contains all 17 providers', () => {
    const keys = Object.keys(PROVIDER_REGISTRY)
    expect(keys).toHaveLength(17)
  })

  it('every provider has required fields', () => {
    for (const [key, def] of Object.entries(PROVIDER_REGISTRY)) {
      expect(def.nangoKey, `${key} missing nangoKey`).toBeTruthy()
      expect(def.displayName, `${key} missing displayName`).toBeTruthy()
      expect(def.icon, `${key} missing icon`).toBeTruthy()
      expect(def.category, `${key} missing category`).toBeTruthy()
      expect(def.resources.length, `${key} has no resources`).toBeGreaterThan(0)
      expect(typeof def.supportsLiveSearch).toBe('boolean')
      expect(typeof def.supportsWrite).toBe('boolean')
    }
  })

  it('getProvider returns correct definition', () => {
    const drive = getProvider('google_drive')
    expect(drive.displayName).toBe('Google Drive')
    expect(drive.nangoKey).toBe('google-drive')
    expect(drive.category).toBe('storage')
  })

  it('getProviderByNangoKey works for reverse lookup', () => {
    const outlook = getProviderByNangoKey('outlook')
    expect(outlook).toBeDefined()
    expect(outlook!.displayName).toBe('Outlook')

    const missing = getProviderByNangoKey('nonexistent')
    expect(missing).toBeUndefined()
  })

  it('getProvidersByCategory returns correct subset', () => {
    const crm = getProvidersByCategory('crm')
    expect(crm.length).toBeGreaterThanOrEqual(2)
    expect(crm.every(p => p.category === 'crm')).toBe(true)

    const displayNames = crm.map(p => p.displayName)
    expect(displayNames).toContain('Salesforce')
    expect(displayNames).toContain('HubSpot')
  })

  it('getWriteProviders returns only write-capable providers', () => {
    const writers = getWriteProviders()
    expect(writers.length).toBeGreaterThan(0)
    expect(writers.every(p => p.supportsWrite)).toBe(true)

    const displayNames = writers.map(p => p.displayName)
    expect(displayNames).toContain('Gmail')
    expect(displayNames).toContain('Google Calendar')
    expect(displayNames).toContain('Outlook')
    expect(displayNames).not.toContain('Slack') // read-only
  })

  it('nangoKeys are all unique', () => {
    const nangoKeys = Object.values(PROVIDER_REGISTRY).map(p => p.nangoKey)
    const uniqueKeys = new Set(nangoKeys)
    expect(uniqueKeys.size).toBe(nangoKeys.length)
  })

  it('ProviderKey type covers all registry keys', () => {
    // Compile-time check: these should all be valid ProviderKey values
    const keys: ProviderKey[] = [
      'sharepoint', 'onedrive', 'outlook', 'ms_calendar',
      'google_drive', 'gmail', 'google_calendar',
      'jira', 'confluence',
      'salesforce', 'hubspot',
      'github', 'linear',
      'slack', 'zendesk',
      'notion', 'snowflake',
    ]
    expect(keys).toHaveLength(17)
  })
})
