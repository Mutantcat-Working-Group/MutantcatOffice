import { ipcMain, powerMonitor } from 'electron'
import type { IpcMainEvent, WebContents } from 'electron'
import { WATCHDOG_PING_CHANNEL, WATCHDOG_PONG_CHANNEL } from './watchdog'

export type WatchdogRecoveryReason =
  | 'crashed'
  | 'unresponsive'
  | 'ping-timeout'
  | 'after-resume'

export interface RendererWatchdogOptions {
  /** heartbeat sweep cadence (default 5s; capped at 5s so recovery stays responsive) */
  pingIntervalMs?: number
  /** how long a renderer may stay silent after a ping before reload (default 15s) */
  pingTimeoutMs?: number
  /** how long a renderer may stay unresponsive before auto-reload (default 20s) */
  unresponsiveReloadMs?: number
  /** delay between system resume and the recovery sweep (default 2s) */
  resumeRecoveryDelayMs?: number
  /** delay before reloading a renderer whose process is gone (default 800ms) */
  crashReloadDelayMs?: number
  onRecover?: (wc: WebContents, reason: WatchdogRecoveryReason) => void
  /** veto a recovery reload before it touches the renderer */
  shouldReload?: (wc: WebContents, reason: WatchdogRecoveryReason) => boolean
}

export interface WatchRendererOptions {
  /** per-renderer override; null disables the unresponsive auto-reload */
  unresponsiveReloadMs?: number | null
}

interface TrackedWebContents {
  wc: WebContents
  pingSentAt: number | null
  unresponsiveAt: number | null
  unresponsiveReloadMs: number | null
  reloading: boolean
  pendingReloadTimer: ReturnType<typeof setTimeout> | null
}

const DEFAULT_PING_INTERVAL_MS = 20_000
const DEFAULT_PING_TIMEOUT_MS = 15_000
const DEFAULT_UNRESPONSIVE_RELOAD_MS = 20_000
const DEFAULT_RESUME_DELAY_MS = 2_000
const DEFAULT_CRASH_DELAY_MS = 800
const RELOAD_FAILSAFE_MS = 60_000

/**
 * Main-process watchdog for every renderer the shell owns (Home plus each
 * editor tab). It recovers renderers whose process is gone, reloads ones that
 * stop answering the heartbeat, and runs a recovery sweep after the machine
 * wakes from sleep/lock — the state that previously left white windows behind.
 */
export class RendererWatchdog {
  private readonly tracked = new Map<number, TrackedWebContents>()
  private readonly sweepTimer: ReturnType<typeof setInterval> | null
  private readonly resumeTimers = new Set<ReturnType<typeof setTimeout>>()
  private readonly pendingReloadTimers = new Set<ReturnType<typeof setTimeout>>()
  private disposed = false

  constructor(private readonly options: RendererWatchdogOptions = {}) {
    ipcMain.on(WATCHDOG_PONG_CHANNEL, this.handlePong)
    powerMonitor.on('suspend', this.handleSuspend)
    powerMonitor.on('resume', this.handleResume)
    powerMonitor.on('lock-screen', this.handleSuspend)
    powerMonitor.on('unlock-screen', this.handleResume)
    const interval = Math.min(options.pingIntervalMs ?? DEFAULT_PING_INTERVAL_MS, 5_000)
    this.sweepTimer = setInterval(() => this.sweep(), Math.max(1_000, interval))
  }

  watch(wc: WebContents, options?: WatchRendererOptions): void {
    if (!wc || wc.isDestroyed() || this.tracked.has(wc.id)) return
    const entry: TrackedWebContents = {
      wc,
      pingSentAt: null,
      unresponsiveAt: null,
      unresponsiveReloadMs:
        options?.unresponsiveReloadMs === undefined
          ? this.options.unresponsiveReloadMs ?? DEFAULT_UNRESPONSIVE_RELOAD_MS
          : options.unresponsiveReloadMs,
      reloading: false,
      pendingReloadTimer: null,
    }
    this.tracked.set(wc.id, entry)
    wc.on('render-process-gone', (_event, details) => {
      if (this.disposed || details.reason === 'clean-exit') return
      this.scheduleReload(entry, 'crashed')
    })
    wc.on('unresponsive', () => {
      if (this.disposed) return
      entry.unresponsiveAt = Date.now()
    })
    wc.on('responsive', () => {
      if (this.disposed) return
      entry.unresponsiveAt = null
    })
    wc.on('did-start-loading', () => {
      entry.pingSentAt = null
    })
    wc.on('did-finish-load', () => {
      entry.pingSentAt = null
      entry.reloading = false
    })
    wc.once('destroyed', () => {
      if (entry.pendingReloadTimer) {
        clearTimeout(entry.pendingReloadTimer)
        this.pendingReloadTimers.delete(entry.pendingReloadTimer)
        entry.pendingReloadTimer = null
      }
      this.tracked.delete(wc.id)
    })
  }

  dispose(): void {
    this.disposed = true
    if (this.sweepTimer) clearInterval(this.sweepTimer)
    for (const timer of this.resumeTimers) clearTimeout(timer)
    this.resumeTimers.clear()
    for (const timer of this.pendingReloadTimers) clearTimeout(timer)
    this.pendingReloadTimers.clear()
    ipcMain.removeListener(WATCHDOG_PONG_CHANNEL, this.handlePong)
    powerMonitor.removeListener('suspend', this.handleSuspend)
    powerMonitor.removeListener('resume', this.handleResume)
    powerMonitor.removeListener('lock-screen', this.handleSuspend)
    powerMonitor.removeListener('unlock-screen', this.handleResume)
    this.tracked.clear()
  }

  private readonly handlePong = (event: IpcMainEvent): void => {
    const entry = this.tracked.get(event.sender.id)
    if (!entry) return
    entry.unresponsiveAt = null
    entry.pingSentAt = null
  }

  private readonly handleSuspend = (): void => {
    // A renderer suspended with the OS cannot answer pings; restart the
    // heartbeat from zero when it wakes so the sleep itself is never counted
    // as a stall.
    for (const entry of this.tracked.values()) {
      entry.pingSentAt = null
      entry.unresponsiveAt = null
    }
  }

  private readonly handleResume = (): void => {
    for (const entry of this.tracked.values()) {
      entry.pingSentAt = null
    }
    const delay = this.options.resumeRecoveryDelayMs ?? DEFAULT_RESUME_DELAY_MS
    const timer = setTimeout(() => this.recoverAfterResume(), delay)
    this.resumeTimers.add(timer)
  }

  private recoverAfterResume(): void {
    this.resumeTimers.clear()
    if (this.disposed) return
    for (const entry of [...this.tracked.values()]) {
      if (entry.wc.isDestroyed()) {
        if (entry.pendingReloadTimer) {
          clearTimeout(entry.pendingReloadTimer)
          this.pendingReloadTimers.delete(entry.pendingReloadTimer)
          entry.pendingReloadTimer = null
        }
        this.tracked.delete(entry.wc.id)
        continue
      }
      if (entry.reloading) continue
      if (entry.pendingReloadTimer) continue
      if (entry.wc.isCrashed()) {
        this.scheduleReload(entry, 'after-resume')
        continue
      }
      // A renderer whose unresponsive auto-reload is disabled (slides keeps
      // its own freeze dialog) must not be yanked away by the resume sweep —
      // still let the normal heartbeat probe it below.
      if (entry.unresponsiveAt !== null && entry.unresponsiveReloadMs !== null) {
        this.scheduleReload(entry, 'after-resume')
        continue
      }
      try {
        // A visible renderer can answer IPC while its GL surface is still a
        // stale white frame after sleep; force a repaint before probing it.
        entry.wc.invalidate()
      } catch {
        // best-effort: the ping sweep below still recovers a dead renderer
      }
      entry.pingSentAt = Date.now()
      try {
        entry.wc.send(WATCHDOG_PING_CHANNEL)
      } catch {
        // the renderer disappeared between the checks above and the send
      }
    }
  }

  private readonly sweep = (): void => {
    if (this.disposed) return
    const now = Date.now()
    const pingTimeoutMs = this.options.pingTimeoutMs ?? DEFAULT_PING_TIMEOUT_MS
    for (const entry of [...this.tracked.values()]) {
      if (entry.wc.isDestroyed()) {
        if (entry.pendingReloadTimer) {
          clearTimeout(entry.pendingReloadTimer)
          this.pendingReloadTimers.delete(entry.pendingReloadTimer)
          entry.pendingReloadTimer = null
        }
        this.tracked.delete(entry.wc.id)
        continue
      }
      if (entry.reloading) continue
      if (entry.pendingReloadTimer) continue
      if (entry.wc.isCrashed()) {
        this.scheduleReload(entry, 'crashed')
        continue
      }
      if (
        entry.unresponsiveAt !== null &&
        entry.unresponsiveReloadMs !== null &&
        now - entry.unresponsiveAt >= entry.unresponsiveReloadMs
      ) {
        this.scheduleReload(entry, 'unresponsive')
        continue
      }
      const waitingForPong = entry.pingSentAt !== null
      const pingTimedOut = waitingForPong && now - entry.pingSentAt! >= pingTimeoutMs
      if (pingTimedOut) {
        this.scheduleReload(entry, 'ping-timeout')
        continue
      }
      if (!waitingForPong) {
        entry.pingSentAt = now
        try {
          entry.wc.send(WATCHDOG_PING_CHANNEL)
        } catch {
          // renderer vanished between the destroyed check and the send
        }
      }
    }
  }

  private scheduleReload(entry: TrackedWebContents, reason: WatchdogRecoveryReason): void {
    if (entry.reloading || entry.pendingReloadTimer || entry.wc.isDestroyed()) return
    if (this.options.shouldReload && !this.options.shouldReload(entry.wc, reason)) return
    const delay =
      reason === 'crashed' ? this.options.crashReloadDelayMs ?? DEFAULT_CRASH_DELAY_MS : 0
    if (delay > 0) {
      const timer = setTimeout(() => this.doReload(entry, reason), delay)
      entry.pendingReloadTimer = timer
      this.pendingReloadTimers.add(timer)
      return
    }
    this.doReload(entry, reason)
  }

  private doReload(entry: TrackedWebContents, reason: WatchdogRecoveryReason): void {
    if (this.disposed || entry.reloading || entry.wc.isDestroyed()) return
    if (entry.pendingReloadTimer) {
      clearTimeout(entry.pendingReloadTimer)
      this.pendingReloadTimers.delete(entry.pendingReloadTimer)
      entry.pendingReloadTimer = null
    }
    entry.reloading = true
    entry.pingSentAt = null
    entry.unresponsiveAt = null
    const wc = entry.wc
    const failsafe = setTimeout(() => {
      if (this.tracked.get(wc.id)?.reloading) {
        entry.reloading = false
      }
    }, RELOAD_FAILSAFE_MS)
    wc.once('did-finish-load', () => {
      clearTimeout(failsafe)
      if (this.tracked.get(wc.id)) {
        entry.reloading = false
        entry.pingSentAt = null
      }
    })
    wc.once('did-fail-load', () => {
      clearTimeout(failsafe)
      entry.reloading = false
      entry.pingSentAt = null
    })
    this.options.onRecover?.(wc, reason)
    try {
      wc.reload()
    } catch {
      entry.reloading = false
    }
  }
}
