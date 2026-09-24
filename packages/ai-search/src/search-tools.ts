/**
 * ai:web-search / ai:image-search for the editors' main processes: reads
 * ai-settings.json live and turns the search provider choice into
 * SearchOptions. A selected custom provider runs first. Parallel uses its free
 * MCP when no key is saved.
 */

import {
  activeSearchProvider,
  type AiSearchProviderId,
  type AiSettings,
} from '@mutantcatoffice/ai-provider'
import { imageSearch, webSearch, type SearchOptions } from './index'
import { readAiSettingsFile } from './media-tools'

export function searchOptionsFromSettings(settings: AiSettings): SearchOptions {
  const provider = activeSearchProvider(settings)
  const key = settings.search?.providers?.[provider]?.apiKey?.trim() ?? ''
  if (provider === 'parallel') return { parallelKey: key, prefer: 'parallel' }
  return provider === 'tavily' ? { tavilyKey: key, prefer: 'tavily' } : { serperKey: key }
}

export function webSearchTool(settingsPath: string, query: string, maxResults = 6) {
  return webSearch(query, maxResults, searchOptionsFromSettings(readAiSettingsFile(settingsPath)))
}

export function imageSearchTool(settingsPath: string, query: string, maxResults = 8) {
  return imageSearch(query, maxResults, searchOptionsFromSettings(readAiSettingsFile(settingsPath)))
}

/** settings-UI test: the selected backend (keyed or free) must answer one minimal query. */
export async function testSearchProvider(
  provider: AiSearchProviderId,
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  apiKey = apiKey.trim()
  if (!apiKey && provider !== 'parallel') return { ok: false, error: 'API key is empty' }
  const options: SearchOptions = {
    serperKey: provider === 'serper' ? apiKey : '',
    tavilyKey: provider === 'tavily' ? apiKey : '',
    parallelKey: provider === 'parallel' ? apiKey : '',
    prefer: provider,
  }
  const r = await webSearch('MutantcatOffice', 1, options)
  if (r.method === provider) return { ok: true }
  return {
    ok: false,
    error:
      r.method === 'error'
        ? (r.error ?? 'search failed')
        : `${provider} did not answer (service unavailable, key rejected or quota exhausted); fell back to ${r.method}`,
  }
}
