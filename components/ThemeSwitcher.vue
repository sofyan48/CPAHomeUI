<template>
  <UPopover>
    <AppButton
      color="neutral"
      variant="ghost"
      :icon="themeIcon"
      :aria-label="`Theme: ${themeLabel}`"
      :title="`Theme: ${themeLabel}`"
    />
    <template #content>
      <div class="grid min-w-40 gap-1 p-1.5">
        <AppButton
          v-for="option in options"
          :key="option.value"
          color="neutral"
          :variant="colorMode.preference === option.value ? 'soft' : 'ghost'"
          :icon="option.icon"
          class="justify-start"
          @click="setTheme(option.value)"
        >
          {{ option.label }}
        </AppButton>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
const colorMode = useColorMode()
const options = [
  { label: 'Light', value: 'light', icon: 'i-tabler-sun' },
  { label: 'Dark', value: 'dark', icon: 'i-tabler-moon' },
  { label: 'System', value: 'system', icon: 'i-tabler-device-desktop' }
]
const activeTheme = computed(() => colorMode.preference === 'system' ? colorMode.value : colorMode.preference)
const themeIcon = computed(() => colorMode.preference === 'system' ? 'i-tabler-device-desktop' : activeTheme.value === 'dark' ? 'i-tabler-moon' : 'i-tabler-sun')
const themeLabel = computed(() => options.find(option => option.value === colorMode.preference)?.label || 'System')
function setTheme(value: string) {
  colorMode.preference = value
}
</script>
