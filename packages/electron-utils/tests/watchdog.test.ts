import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  WATCHDOG_PING_CHANNEL,
  WATCHDOG_PONG_CHANNEL,
  installWatchdogPong,
} from '../src/watchdog'

function makeIpcRenderer() {
  const listeners = new Map<string, (...args: unknown[]) => void>()
  return {
    listeners,
    on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
      listeners.set(channel, listener)
    }),
    send: vi.fn(),
  }
}

describe('installWatchdogPong', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Reflect.deleteProperty(globalThis, Symbol.for('genoffice.watchdog-pong-installed'))
  })

  it('answers every heartbeat ping with a pong', () => {
    const ipc = makeIpcRenderer()
    installWatchdogPong(ipc)

    const ping = ipc.listeners.get(WATCHDOG_PING_CHANNEL)
    expect(ping).toBeTypeOf('function')
    ping?.()
    ping?.()

    expect(ipc.send).toHaveBeenCalledTimes(2)
    expect(ipc.send).toHaveBeenCalledWith(WATCHDOG_PONG_CHANNEL)
  })

  it('stays idempotent when installed twice in the same preload', () => {
    const ipc = makeIpcRenderer()
    installWatchdogPong(ipc)
    installWatchdogPong(ipc)

    expect(ipc.on).toHaveBeenCalledTimes(1)
    expect(ipc.on).toHaveBeenCalledWith(WATCHDOG_PING_CHANNEL, expect.any(Function))
  })
})
