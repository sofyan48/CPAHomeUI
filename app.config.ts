export default defineAppConfig({
  ui: {
    colors: {
      primary: "sky",
      neutral: "slate",
    },
    card: {
      slots: {
        root: "rounded-2xl overflow-hidden bg-white/40 dark:bg-neutral-900/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-[0_8px_32px_0_rgba(14,165,233,0.1)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] ring-0",
        header: "px-4 py-3 sm:px-5 border-b border-white/20 dark:border-white/5",
        body: "p-4 sm:p-5",
        footer: "px-4 py-3 sm:px-5 border-t border-white/20 dark:border-white/5",
      },
    },
    formField: {
      slots: {
        root: "min-w-0",
        labelWrapper: "mb-1.5 flex min-w-0 items-center justify-between gap-2",
        label: "truncate text-sm font-medium text-default",
        hint: "shrink-0 text-xs text-muted",
        help: "mt-1.5 text-xs text-muted",
        error: "mt-1.5 text-xs text-error",
      },
    },
    input: {
      defaultVariants: {
        size: "md",
        variant: "outline",
      },
    },
    select: {
      defaultVariants: {
        size: "md",
        variant: "outline",
      },
    },
    selectMenu: {
      defaultVariants: {
        size: "md",
        variant: "outline",
      },
    },
    textarea: {
      defaultVariants: {
        size: "md",
        variant: "outline",
      },
    },
    modal: {
      slots: {
        header: "px-4 py-3 sm:px-5",
        body: "p-4 sm:p-5",
        footer: "px-4 py-3 sm:px-5",
        title: "text-base font-semibold text-highlighted",
      },
    },
    table: {
      slots: {
        root: "relative overflow-auto",
        th: "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted",
        td: "px-4 py-3 text-sm text-default whitespace-nowrap align-middle",
        empty: "py-12 text-center text-sm text-muted",
        loading: "py-12 text-center",
      },
    },
    button: {
      defaultVariants: {
        color: "primary",
      },
    },
    badge: {
      defaultVariants: {
        color: "primary",
      },
    },
  },
});
