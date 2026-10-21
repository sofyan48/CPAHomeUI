<template>
  <UPopover v-model:open="open">
    <AppButton
      icon="i-tabler-language"
      color="neutral"
      variant="ghost"
      :aria-label="`${t('language.label')}: ${activeLabel}`"
      :title="`${t('language.label')}: ${activeLabel}`"
    />
    <template #content>
      <div class="grid min-w-40 gap-1 p-1.5" role="group" :aria-label="t('language.label')">
        <AppButton
          v-for="option in languages"
          :key="option.value"
          color="neutral"
          :variant="locale === option.value ? 'soft' : 'ghost'"
          class="justify-start"
          :lang="option.value"
          :aria-pressed="locale === option.value"
          @click="selectLanguage(option.value)"
        >
          {{ option.label }}
        </AppButton>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import { useConsoleLocale, type ConsoleLocale } from '~/composables/useConsoleLocale'

const { locale, languages, setLocale, t } = useConsoleLocale()
const open = ref(false)
const activeLabel = computed(() => languages.find(option => option.value === locale.value)?.label)

function selectLanguage(value: ConsoleLocale) {
  setLocale(value)
  open.value = false
}
</script>
