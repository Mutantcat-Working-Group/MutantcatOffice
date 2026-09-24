import { createRoot } from 'react-dom/client'
import { htmlLang, type Lang } from '@mutantcatoffice/i18n'
import App from './App'
import { LocaleProvider } from './i18n/locale'
import type { UiTheme } from '../shared/ipc'
import '@mutantcatoffice/ui/tokens.css'
import '@mutantcatoffice/ui/screentip.css'
import '@mutantcatoffice/ui/color-picker.css'
import '@mutantcatoffice/ui/dropdown.css'
import '@mutantcatoffice/ui/ribbon-collapse.css'
import '@mutantcatoffice/ui/markdown.css'
import '@mutantcatoffice/ui/ai-panel-prefs.css'
import '@mutantcatoffice/ui/ai-scope-quote.css'
import './styles.css'
import { applyAiPanelPrefs, installScreenTips } from '@mutantcatoffice/ui'

installScreenTips()

function applyTheme(theme: UiTheme): void {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
}

void (async () => {
  const [lang, theme] = await Promise.all([
    window.pdfApi.getLanguage().catch(() => 'zh' as const),
    window.pdfApi.getTheme().catch(() => 'system' as const),
  ])
  document.documentElement.lang = htmlLang(lang as Lang)
  applyTheme(theme)
  window.pdfApi.onThemeChanged(applyTheme)
  void window.pdfApi
    ?.getAiPanelPrefs?.()
    .then(applyAiPanelPrefs)
    .catch(() => {})
  window.pdfApi?.onAiPanelPrefsChanged?.(applyAiPanelPrefs)
  createRoot(document.getElementById('root')!).render(
    <LocaleProvider initial={lang}>
      <App />
    </LocaleProvider>,
  )
})()
