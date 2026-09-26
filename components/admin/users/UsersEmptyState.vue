<template>
  <div class="flex flex-col items-center justify-center px-6 py-10 text-center text-sm text-[var(--ui-text-muted)]">
    <UIcon :name="icon" class="mb-2 size-6" />
    <p>{{ text }}</p>
  </div>
</template>

<script>
export default {
  props: ['icon', 'text']
}
</script>
