<template>
  <section class="grid gap-3">
    <h3 class="text-sm font-semibold">{{ title }}</h3>
    <dl class="grid gap-2 text-sm">
      <div v-for="item in items" :key="item.label" class="rounded-md border border-[var(--ui-border)] px-3 py-2.5">
        <dt class="text-xs text-[var(--ui-text-muted)]">{{ item.label }}</dt>
        <dd class="mt-1 break-words">{{ item.value }}</dd>
      </div>
    </dl>
  </section>
</template>

<script>
export default {
  props: ['title', 'items']
}
</script>
