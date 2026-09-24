import {
  activeSearchProvider,
  activeMediaProvider,
  imageGenerationAvailable,
  mediaAnalysisAvailable,
} from '@mutantcatoffice/ai-provider'
import { readAiSettingsFile, readStoredAiSettingsFile } from '@mutantcatoffice/ai-search'
import { aiSettingsPath, prepareCloud } from '../cloud'
import type { CommandDef } from '../registry'
import { appLaunch } from '../resources'

/**
 * What the cloud commands can do on this machine, decided from MutantcatOffice's
 * own settings without a network call: a BYOK key, or explicitly selected free
 * Parallel search. Unkeyed fallbacks (DuckDuckGo) do not count as configured.
 * Agents check this once before planning work that needs photos or web facts.
 */
export const capabilitiesCommand: CommandDef = {
  name: 'capabilities',
  summary:
    'Report which cloud features (search, image search, image generation, media analysis) are configured in MutantcatOffice, and whether the app is installed.',
  usage: 'capabilities',
  async run(_args, ctx) {
    await prepareCloud(ctx.env)
    const path = aiSettingsPath(ctx.env)
    const stored = readStoredAiSettingsFile(path)
    const settings = readAiSettingsFile(path)
    const searchProvider = activeSearchProvider(settings)
    // Parallel is free but only counts once the user explicitly picked it in
    // the settings file; a missing search block falls back to it unconfigured.
    const configuredSearch =
      stored.search && stored.search.provider === searchProvider ? searchProvider : null
    const search = configuredSearch !== null
    const imageSearch = configuredSearch === 'serper'
    const imageGeneration = imageGenerationAvailable(settings)
    const mediaAnalysis = mediaAnalysisAvailable(settings)
    const via = (byok: string | null | undefined) => byok
    const detail = {
      search: {
        available: search,
        via: searchProvider,
      },
      image_search: {
        available: imageSearch,
        via: configuredSearch === 'serper' ? 'serper' : null,
      },
      image_generation: {
        available: imageGeneration,
        via: imageGeneration ? via(activeMediaProvider(settings, 'image')) : null,
      },
      media_analysis: {
        available: mediaAnalysis,
        via: mediaAnalysis ? via(activeMediaProvider(settings, 'analysis')) : null,
      },
      app: { available: appLaunch(ctx.env) !== null },
      settings_path: aiSettingsPath(ctx.env),
    }
    const on = Object.entries(detail)
      .filter(([k, v]) => k !== 'settings_path' && (v as { available: boolean }).available)
      .map(([k]) => k)
    return {
      summary: on.length
        ? `configured: ${on.join(', ')}`
        : 'no cloud feature configured; the app is not installed',
      detail,
    }
  },
}
