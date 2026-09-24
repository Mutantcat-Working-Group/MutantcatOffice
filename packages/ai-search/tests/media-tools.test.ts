import { describe, it, expect, vi, beforeEach } from 'vitest'

import { generateImageTool } from '../src/media-tools'
vi.mock('@mutantcatoffice/electron-utils/remote-image', () => ({
  fetchRemoteImage: vi.fn(async () => {
    return new Response('img', { status: 200, headers: { 'content-type': 'image/png' } })
  }),
}))
const SETTINGS = '/nonexistent/ai-settings.json'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateImageTool', () => {
  it('returns an error when no image provider is configured', async () => {
    const r = await generateImageTool(SETTINGS, {
      prompt: 'red podcast icon',
      transparentBackground: true,
    })
    expect(r).toEqual({ error: 'No image provider configured' })
  })
})
