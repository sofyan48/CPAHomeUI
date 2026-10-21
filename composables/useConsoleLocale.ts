import { readonly } from 'vue'
import { useHead, useState } from '#imports'
import en from '~/locales/en'
import zhCN from '~/locales/zh-CN'
import zhTW from '~/locales/zh-TW'
import ru from '~/locales/ru'
import type { ConsoleMessageKey, ConsoleMessages } from '~/locales/en'

export type ConsoleLocale = 'en' | 'zh-CN' | 'zh-TW' | 'ru'

export const consoleLanguages: ReadonlyArray<{ value: ConsoleLocale; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'ru', label: 'Русский' }
]

const messages: Record<ConsoleLocale, ConsoleMessages> = { en, 'zh-CN': zhCN, 'zh-TW': zhTW, ru }
const storageKey = 'cpahome:console-locale'

export function resolveConsoleLocale(language: string): ConsoleLocale | undefined {
  const tag = language.trim().replace(/_/g, '-').toLowerCase()
  if (tag === 'en' || tag.startsWith('en-')) return 'en'
  if (tag === 'ru' || tag.startsWith('ru-')) return 'ru'
  if (tag === 'zh' || tag.startsWith('zh-')) {
    const subtags = tag.split('-')
    if (subtags.includes('hant')) return 'zh-TW'
    if (subtags.includes('hans')) return 'zh-CN'
    return subtags.some(part => ['tw', 'hk', 'mo'].includes(part)) ? 'zh-TW' : 'zh-CN'
  }
}

export function useConsoleLocale() {
  const locale = useState<ConsoleLocale>('console:locale', () => 'en')
  const initialized = useState('console:locale-initialized', () => false)

  if (import.meta.client && !initialized.value) {
    let saved: string | null = null
    try {
      saved = window.localStorage.getItem(storageKey)
    } catch {
      // Browser privacy settings may disable storage; locale switching still works.
    }
    const persisted = consoleLanguages.find(option => option.value === saved)?.value
    const preferred = (navigator.languages?.length ? navigator.languages : [navigator.language])
      .map(resolveConsoleLocale).find((value): value is ConsoleLocale => Boolean(value))
    locale.value = persisted || preferred || 'en'
    initialized.value = true
  }

  useHead(() => ({ htmlAttrs: { lang: locale.value } }))

  function setLocale(value: ConsoleLocale) {
    if (!consoleLanguages.some(option => option.value === value)) return
    locale.value = value
    if (import.meta.client) {
      try {
        window.localStorage.setItem(storageKey, value)
      } catch {
        // Keep the in-memory preference when persistent storage is unavailable.
      }
    }
  }

  function t(key: ConsoleMessageKey): string {
    return messages[locale.value][key] ?? en[key]
  }

  return { locale: readonly(locale), languages: consoleLanguages, setLocale, t }
}
