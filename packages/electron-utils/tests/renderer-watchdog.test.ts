import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WATCHDOG_PING_CHANNEL, WATCHDOG_PONG_CHANNEL } from '../src/watchdog'
import { RendererWatchdog } from '../src/renderer-watchdog'

interface FakeWebContents {
  id: number
  on: ReturnType<typeof vi.fn>
  once: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  reload: ReturnType<typeof vi.fn>
  invalidate: ReturnType<typeof vi.fn>
  isCrashed: ReturnType<typeof vi.fn>
  isDestroyed: ReturnType<typeof vi.fn>
}

function makeWebContents(id: number): FakeWebContents {
  return {
    id,
    on: vi.fn(),
    once: vi.fn(),
    send: vi.fn(),
    reload: vi.fn(),
    invalidate: vi.fn(),
    isCrashed: vi.fn(() => false),
    isDestroyed: vi.fn(() => false),
  }
}

const ipcMainMock = vi.hoisted(() => ({ on: vi.fn(), removeListener: vi.fn() }))
const powerMonitorMock = vi.hoisted(() => ({
  on: vi.fn(),
  removeListener: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: ipcMainMock,
  powerMonitor: powerMonitorMock,
}))

function pongFor(wcId: number): void {
  const handler = ipcMainMock.on.mock.calls.find(
    ([channel]) => channel === WATCHDOG_PONG_CHANNEL,
  )?.[1] as (event: { sender: { id: number } }) => void
  handler({ sender: { id: wcId } })
}

describe('RendererWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reloads a renderer that stops answering the heartbeat', () => {
    const wc = makeWebContents(1)
    const watchdog = new RendererWatchdog({ pingIntervalMs: 1_000, pingTimeoutMs: 500 })
    watchdog.watch(wc as never)

    vi.advanceTimersByTime(2_000)
    expect(wc.reload).toHaveBeenCalledTimes(1)
    watchdog.dispose()
  })

  it('keeps a renderer alive while pongs arrive', () => {
    const wc = makeWebContents(2)
    const watchdog = new RendererWatchdog({ pingIntervalMs: 1_000, pingTimeoutMs: 500 })
    watchdog.watch(wc as never)

    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(700)
      pongFor(2)
    }
    expect(wc.reload).not.toHaveBeenCalled()
    watchdog.dispose()
  })

  it('reloads after render-process-gone with a small delay', () => {
    const wc = makeWebContents(3)
    const watchdog = new RendererWatchdog({ crashReloadDelayMs: 500 })
    watchdog.watch(wc as never)

    const crashHandler = wc.on.mock.calls.find(([event]) => event === 'render-process-gone')![1]
    crashHandler({}, { reason: 'killed' })
    vi.advanceTimersByTime(600)

    expect(wc.reload).toHaveBeenCalledTimes(1)
    watchdog.dispose()
  })

  it('recovers healthy renderers with a repaint nudge after resume', () => {
    const wc = makeWebContents(4)
    const watchdog = new RendererWatchdog({ resumeRecoveryDelayMs: 100 })
    watchdog.watch(wc as never)

    const resumeHandler = powerMonitorMock.on.mock.calls.find(([event]) => event === 'resume')![1]
    resumeHandler()
    vi.advanceTimersByTime(200)

    expect(wc.invalidate).toHaveBeenCalled()
    expect(wc.send).toHaveBeenCalledWith(WATCHDOG_PING_CHANNEL)
    watchdog.dispose()
  })

  it('reloads a renderer still unresponsive after resume', () => {
    const wc = makeWebContents(5)
    const watchdog = new RendererWatchdog({ resumeRecoveryDelayMs: 100 })
    watchdog.watch(wc as never)
    wc.isCrashed.mockReturnValue(true)

    const resumeHandler = powerMonitorMock.on.mock.calls.find(([event]) => event === 'resume')![1]
    resumeHandler()
    vi.advanceTimersByTime(200)

    expect(wc.reload).toHaveBeenCalled()
    watchdog.dispose()
  })

  it('leaves the freeze dialog owner alone when unresponsive reload is disabled', () => {
    const wc = makeWebContents(7)
    const watchdog = new RendererWatchdog({ resumeRecoveryDelayMs: 100 })
    watchdog.watch(wc as never, { unresponsiveReloadMs: null })

    const unresponsiveHandler = wc.on.mock.calls.find(([event]) => event === 'unresponsive')![1]
    unresponsiveHandler()
    const resumeHandler = powerMonitorMock.on.mock.calls.find(([event]) => event === 'resume')![1]
    resumeHandler()
    vi.advanceTimersByTime(200)

    expect(wc.reload).not.toHaveBeenCalled()
    expect(wc.invalidate).toHaveBeenCalled()
    watchdog.dispose()
  })

  it('skips unresponsive auto-reload when disabled per renderer', () => {
    const wc = makeWebContents(6)
    const watchdog = new RendererWatchdog({ unresponsiveReloadMs: 50, pingTimeoutMs: 60_000 })
    watchdog.watch(wc as never, { unresponsiveReloadMs: null })

    const unresponsiveHandler = wc.on.mock.calls.find(([event]) => event === 'unresponsive')![1]
    unresponsiveHandler()
    vi.advanceTimersByTime(5_000)

    expect(wc.reload).not.toHaveBeenCalled()
    watchdog.dispose()
  })
})
