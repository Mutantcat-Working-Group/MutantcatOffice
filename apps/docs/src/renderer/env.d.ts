/// <reference types="vite/client" />

import type { DesktopApi } from '../shared/ipc'
import type { ProjectApi } from '@mutantcatoffice/project-store'

declare global {
  interface Window {
    desktop: DesktopApi
    projectApi: ProjectApi
  }
}

export {}
