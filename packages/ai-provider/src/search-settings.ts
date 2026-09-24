import type {
  AiSearchProviderId,
  AiSearchProviderMeta,
  AiSearchSettings,
  AiSettings,
} from './types'

export const AI_SEARCH_PROVIDERS: AiSearchProviderMeta[] = [
  { id: 'serper', label: 'Serper', keyPlaceholder: 'Serper API key', imageSearch: true },
  { id: 'tavily', label: 'Tavily', keyPlaceholder: 'tvly-...', imageSearch: false },
  { id: 'parallel', label: 'Parallel', keyPlaceholder: 'Parallel API key', imageSearch: false },
]

/** Keyless default; the first catalog entry (Serper) still requires a key. */
export const DEFAULT_AI_SEARCH_PROVIDER: AiSearchProviderId = 'parallel'

export function defaultAiSearchSettings(): AiSearchSettings {
  return {
    provider: DEFAULT_AI_SEARCH_PROVIDER,
    providers: { serper: { apiKey: '' }, tavily: { apiKey: '' }, parallel: { apiKey: '' } },
  }
}

export function resolveAiSearchSettings(
  stored: Partial<AiSearchSettings> | undefined,
): AiSearchSettings {
  const defaults = defaultAiSearchSettings()
  if (!stored) return defaults
  const providers = { ...defaults.providers }
  for (const id of ['serper', 'tavily', 'parallel'] as const) {
    const key = stored.providers?.[id]?.apiKey
    if (typeof key === 'string') providers[id] = { apiKey: key.trim() }
  }
  return { provider: stored.provider ?? defaults.provider, providers }
}

/** Parallel can run keylessly; other providers require a key. */
export function activeSearchProvider(settings: Pick<AiSettings, 'search'>): AiSearchProviderId {
  const search = settings.search
  if (!search) return DEFAULT_AI_SEARCH_PROVIDER
  if (!AI_SEARCH_PROVIDERS.some((m) => m.id === search.provider)) {
    return DEFAULT_AI_SEARCH_PROVIDER
  }
  if (search.provider === 'parallel') return 'parallel'
  // Trim-aware: a whitespace-only key from in-memory settings falls back
  // instead of sending `Bearer    ` to the search backend.
  return search.providers?.[search.provider]?.apiKey?.trim()
    ? search.provider
    : DEFAULT_AI_SEARCH_PROVIDER
}
