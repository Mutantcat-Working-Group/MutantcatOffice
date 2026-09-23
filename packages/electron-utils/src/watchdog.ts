/**
 * Shared renderer-watchdog channels plus the preload-side heartbeat listener.
 *
 * The shell main process pings every watched webContents (`watchdog:ping`);
 * each renderer answers with `watchdog:pong` from its preload so the main
 * process can tell a hung/backgrounded renderer from a healthy one without
 * reaching into page scripts.
 */
export const WATCHDOG_PING_CHANNEL = 'watchdog:ping'
export const WATCHDOG_PONG_CHANNEL = 'watchdog:pong'

/** the subset of Electron's ipcRenderer the heartbeat installer needs */
export interface WatchdogIpcRenderer {
  on(channel: string, listener: (...args: unknown[]) => void): unknown
  send(channel: string, ...args: unknown[]): void
}

/** Symbol.for keeps repeated installs idempotent when several bundled copies of
 *  this module end up in one preload (mirrors drop-open). */
const INSTALLED = Symbol.for('genoffice.watchdog-pong-installed')

/** Preload-side hook: answer the main process heartbeat for this renderer. */
export function installWatchdogPong(api: WatchdogIpcRenderer): void {
  const holder = globalThis as Record<symbol, boolean | undefined>
  if (holder[INSTALLED]) return
  holder[INSTALLED] = true
  api.on(WATCHDOG_PING_CHANNEL, () => api.send(WATCHDOG_PONG_CHANNEL))
}
