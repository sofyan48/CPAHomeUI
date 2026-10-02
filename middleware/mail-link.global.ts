// Mail links keep one-time tokens in the fragment so they are not sent to the server.
export default defineNuxtRouteMiddleware((to) => {
  const fragment = to.hash.slice(1)
  const separator = fragment.indexOf('?')
  const path = separator < 0 ? fragment : fragment.slice(0, separator)
  const target = path === '/user/verify-email'
    ? '/app/verify-email'
    : path === '/user/reset-password'
      ? '/app/reset-password'
      : null
  if (!target) return

  const params = new URLSearchParams(separator < 0 ? '' : fragment.slice(separator + 1))
  // Keep the token in the fragment until the destination captures and removes it.
  const token = params.get('token') || ''
  return navigateTo({ path: target, hash: token ? `#token=${encodeURIComponent(token)}` : '' }, { replace: true })
})
