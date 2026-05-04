import { vi, describe, it, expect, beforeEach } from 'vitest'
import { fetchJiraIssues, searchJiraIssues } from '../jira-fetcher'
import { fetchConfluencePages } from '../confluence-fetcher'
import * as client from '../client'
import * as base from '../../base'

// Mock the client and base
vi.mock('../client', () => ({
  getAtlassianResources: vi.fn(),
  atlassianFetch: vi.fn(),
}))

vi.mock('../../base', async () => {
  const actual = await vi.importActual('../../base') as any
  return {
    ...actual,
    assertSafeMetadata: vi.fn(),
  }
})

describe('Atlassian Fetchers (ATH-31 Verification)', () => {
  const mockOrgId = 'org-123'
  const mockConnId = 'conn-456'
  const mockResources = [
    { id: 'cloud-123', url: 'https://test-site.atlassian.net', name: 'Test Site' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    ;(client.getAtlassianResources as any).mockResolvedValue(mockResources)
  })

  describe('Jira Fetcher', () => {
    it('handles pagination and constructs correct dynamic source_url', async () => {
      // Mock two pages of results
      ;(client.atlassianFetch as any)
        .mockResolvedValueOnce({
          issues: [{ id: '1', key: 'PROJ-1', fields: { summary: 'Issue 1', updated: '2026-04-30T00:00:00Z', status: { name: 'Open' } } }],
          total: 2,
          startAt: 0
        })
        .mockResolvedValueOnce({
          issues: [{ id: '2', key: 'PROJ-2', fields: { summary: 'Issue 2', updated: '2026-04-30T00:00:00Z', status: { name: 'Done' } } }],
          total: 2,
          startAt: 1
        })

      const chunks = await fetchJiraIssues(mockConnId, mockOrgId, { limit: 1 })

      expect(chunks).toHaveLength(2)
      // Verify dynamic source_url fix (Issue #3)
      expect(chunks[0].source_url).toBe('https://test-site.atlassian.net/browse/PROJ-1')
      expect(chunks[1].source_url).toBe('https://test-site.atlassian.net/browse/PROJ-2')
      
      // Verify assertSafeMetadata was called (Issue #4)
      expect(base.assertSafeMetadata).toHaveBeenCalledTimes(2)
      expect(client.atlassianFetch).toHaveBeenCalledTimes(2)
    })

    it('searchJiraIssues (Mode B) returns correct shape', async () => {
      ;(client.atlassianFetch as any).mockResolvedValueOnce({
        issues: [{ id: '1', key: 'SEARCH-1', fields: { summary: 'Search result', updated: '2026-04-30T00:00:00Z' } }]
      })

      const results = await searchJiraIssues(mockConnId, 'text ~ "test"', mockOrgId)

      expect(results).toHaveLength(1)
      expect(results[0].title).toContain('SEARCH-1')
      expect(results[0].source_url).toBe('https://test-site.atlassian.net/browse/SEARCH-1')
    })
  })

  describe('Confluence Fetcher', () => {
    it('handles cursor pagination and constructs correct dynamic source_url', async () => {
      const mockConfluenceResources = [
        { id: 'cloud-456', url: 'https://test-site.atlassian.net/wiki', name: 'Test Confluence' }
      ]
      ;(client.getAtlassianResources as any).mockResolvedValue(mockConfluenceResources)

      ;(client.atlassianFetch as any).mockResolvedValueOnce({
        results: [{ id: 'p1', title: 'Page 1', _links: { webui: '/spaces/S1/pages/1' }, version: { createdAt: '2026-04-30T00:00:00Z' } }],
        _links: {} // No next page
      })

      const chunks = await fetchConfluencePages(mockConnId, mockOrgId)

      expect(chunks).toHaveLength(1)
      // Verify dynamic source_url fix (Issue #3) - should not have double /wiki if URL already has it
      expect(chunks[0].source_url).toBe('https://test-site.atlassian.net/wiki/spaces/S1/pages/1')
      
      // Verify assertSafeMetadata was called (Issue #4)
      expect(base.assertSafeMetadata).toHaveBeenCalled()
    })
  })
})
