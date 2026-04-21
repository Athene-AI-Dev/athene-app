import { describe, it, expect, vi, beforeEach } from 'vitest';
import { githubIssuesFetcher } from '../lib/integrations/github/issues-fetcher';
import { linearProjectsFetcher } from '../lib/integrations/linear/projects-fetcher';
import { indexDocument } from '../lib/integrations/indexer';
import { getConnectionToken } from '../lib/nango/client';
import { supabase } from '../lib/supabase/server';

// Mock dependencies
vi.mock('../lib/nango/client', () => ({
  getConnectionToken: vi.fn(),
}));

vi.mock('../lib/integrations/indexer', () => ({
  indexDocument: vi.fn(),
}));

vi.mock('../lib/supabase/server', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(),
      select: vi.fn(),
      upsert: vi.fn(),
    })),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Integrations Fetchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GitHub Fetcher', () => {
    it('should fetch issues and construct FetchedChunk array without calling Supabase', async () => {
      // Mock Nango
      (getConnectionToken as any).mockResolvedValue('fake-nango-token');

      // Mock GitHub API Response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              issues: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                  {
                    id: 'issue-1',
                    title: 'Test Issue',
                    body: 'Test body',
                    url: 'https://github.com/test/repo/issues/1',
                    createdAt: '2023-01-01T00:00:00Z',
                    comments: { nodes: [{ body: 'Comment 1' }] },
                  },
                ],
              },
            },
          },
        }),
      });

      const chunks = await githubIssuesFetcher('conn-1', 'org-1', 'test_owner', 'test_repo');

      // Assert Nango Mock
      expect(getConnectionToken).toHaveBeenCalledWith('conn-1', 'github', 'org-1');

      // Assert Shape
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        id: 'issue-1',
        title: 'Test Issue',
        provider: 'github',
        type: 'issue',
        metadata: { owner: 'test_owner', repo: 'test_repo' },
      });
      expect(chunks[0].content).toContain('Test Issue');
      expect(chunks[0].content).toContain('Test body');
      expect(chunks[0].content).toContain('Comment 1');

      // Assert Indexing
      expect(indexDocument).toHaveBeenCalledWith(chunks[0]);

      // Assert no Supabase write
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('Linear Fetcher', () => {
    it('should fetch projects and construct FetchedChunk array without calling Supabase', async () => {
      (getConnectionToken as any).mockResolvedValue('fake-linear-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            projects: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  id: 'proj-1',
                  name: 'Alpha Project',
                  description: 'Project Desc',
                  url: 'https://linear.app/project/1',
                  createdAt: '2023-01-01T00:00:00Z',
                  projectUpdates: { nodes: [{ body: 'Update 1' }] },
                },
              ],
            },
          },
        }),
      });

      const chunks = await linearProjectsFetcher('conn-2', 'org-1');

      expect(getConnectionToken).toHaveBeenCalledWith('conn-2', 'linear', 'org-1');

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        id: 'proj-1',
        title: 'Alpha Project',
        provider: 'linear',
        type: 'project',
      });
      expect(chunks[0].content).toContain('Alpha Project');
      expect(chunks[0].content).toContain('Project Desc');
      expect(chunks[0].content).toContain('Update 1');

      expect(indexDocument).toHaveBeenCalledWith(chunks[0]);
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });
});
