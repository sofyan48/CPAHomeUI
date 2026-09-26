export default defineAppConfig({
  ui: {
    checkbox: {
      defaultVariants: {
        size: 'sm'
      },
      slots: {
        root: 'items-center',
        container: '!h-4',
        base: '!size-3.5 !min-h-0 !min-w-0 rounded-[4px] border border-[var(--ui-border)] bg-[var(--glass-card-strong)] shadow-none ring-0 data-[state=checked]:border-[var(--ui-primary)] data-[state=indeterminate]:border-[var(--ui-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-1',
        indicator: 'bg-[var(--ui-primary)] text-white',
        icon: '!size-2.5',
        wrapper: 'text-sm'
      },
      variants: {
        size: {
          sm: {
            base: '!size-3.5',
            container: '!h-4',
            wrapper: 'text-sm'
          }
        }
      }
    },
    switch: {
      defaultVariants: {
        size: 'xs'
      },
      slots: {
        root: 'items-center',
        base: '!h-3.5 !w-8 !border-0 !p-0 shadow-none data-[state=unchecked]:bg-[var(--ui-bg-accented)]',
        container: '!h-3.5',
        thumb: '!size-2.5 shadow-none data-[state=unchecked]:!translate-x-0.5 data-[state=checked]:!translate-x-5 rtl:data-[state=unchecked]:!-translate-x-0.5 rtl:data-[state=checked]:!-translate-x-5'
      },
      variants: {
        size: {
          xs: {
            base: '!h-3.5 !w-8',
            container: '!h-3.5',
            thumb: '!size-2.5 data-[state=unchecked]:!translate-x-0.5 data-[state=checked]:!translate-x-5 rtl:data-[state=unchecked]:!-translate-x-0.5 rtl:data-[state=checked]:!-translate-x-5',
            wrapper: 'text-xs'
          }
        }
      }
    },
    table: {
      slots: {
        root: 'relative w-full overflow-auto rounded-lg border border-[var(--glass-border)] bg-[var(--glass-card-strong)]',
        base: 'min-w-full border-separate border-spacing-0',
        caption: 'sr-only',
        thead: 'relative bg-[color-mix(in_oklch,var(--glass-card-strong)_84%,var(--ui-bg-muted))]',
        tbody: '[&>tr]:transition-colors [&>tr:hover]:bg-[var(--ui-hover)]',
        tfoot: 'relative',
        tr: 'group data-[selected=true]:bg-[var(--ui-selected)]',
        th: 'h-9 border-b border-[var(--ui-border-muted)] px-3 py-2 text-left text-xs font-medium text-[var(--ui-text-muted)] whitespace-nowrap first:pl-4 last:pr-4 last:text-right',
        td: 'h-11 border-b border-[var(--ui-border-muted)] px-3 py-2 text-[13px] text-[var(--ui-text)] align-middle first:pl-4 last:pr-4 last:text-right group-last:border-b-0',
        separator: 'absolute left-0 z-[1] h-px w-full bg-[var(--ui-border)]',
        empty: 'border-b-0 bg-transparent py-12 text-center text-sm text-[var(--ui-text-muted)]',
        loading: 'border-b-0 bg-transparent py-12 text-center'
      }
    }
  }
})
