<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold">System nodes</h1>
        <p class="mt-1 max-w-3xl text-sm text-[var(--ui-text-muted)]">Inspect Home topology, manage connected CPA nodes, and generate mTLS enrollment credentials.</p>
      </div>
    </div>

    <UAlert color="info" variant="subtle" icon="i-tabler-info-circle" title="mTLS enrollment" description="Home RESP access is mTLS-only. Generate a one-time Home JWT here, then provide it to the CPA node enrollment workflow. Treat the JWT as a secret." />
    <UAlert v-if="errorMessage" color="error" variant="subtle" icon="i-tabler-alert-circle" title="Enrollment failed" :description="errorMessage" />

    <div class="grid gap-6 xl:grid-cols-2">
      <UCard>
        <template #header>
          <div>
            <h2 class="font-semibold">Generate client enrollment</h2>
            <p class="text-xs text-[var(--ui-text-muted)]">Creates a pending client certificate record and enrollment JWT.</p>
          </div>
        </template>
        <form class="space-y-4" @submit.prevent="generateEnrollment">
          <UFormField label="Node name" hint="Optional; maximum 128 Unicode characters">
            <UInput v-model="nodeName" maxlength="128" placeholder="primary-cpa" class="w-full" />
          </UFormField>
          <div class="flex justify-end">
            <UButton type="submit" icon="i-tabler-key" :loading="generating">Generate enrollment JWT</UButton>
          </div>
        </form>
      </UCard>

      <UCard>
        <template #header><h2 class="font-semibold">Enrollment result</h2></template>
        <div v-if="enrollment" class="space-y-4">
          <UFormField label="Certificate ID"><UInput :model-value="enrollment.id" readonly class="w-full font-mono" /></UFormField>
          <UFormField label="Node name"><UInput :model-value="enrollment.node_name || 'Unnamed node'" readonly class="w-full" /></UFormField>
          <UFormField label="Home JWT">
            <UTextarea :model-value="enrollment.home_jwt" :rows="8" readonly class="w-full break-all font-mono text-xs" />
          </UFormField>
          <div class="flex justify-end">
            <UButton color="neutral" variant="outline" icon="i-tabler-clipboard" @click="copyJWT">Copy JWT</UButton>
          </div>
          <UAlert color="warning" variant="subtle" title="Store it now" description="The JWT contains enrollment secret material. This page does not retain the result after navigation or refresh." />
        </div>
        <div v-else class="flex min-h-56 flex-col items-center justify-center text-center text-[var(--ui-text-muted)]">
          <UIcon name="i-tabler-id" class="size-10" />
          <p class="mt-3 text-sm">No enrollment has been generated in this session.</p>
        </div>
      </UCard>
    </div>

    <SystemTopology />

    <UCard>
      <template #header><div><h2 class="font-semibold">Node network diagnostics</h2><p class="text-xs text-[var(--ui-text-muted)]">Send a controlled request from Home to verify provider or node-reachable endpoints.</p></div></template>
      <UAlert color="warning" variant="subtle" icon="i-tabler-shield-exclamation" title="Administrative network access" description="The request originates from Home and can reach services available to that server. Use only trusted URLs; responses may contain sensitive upstream data." class="mb-5" />
      <div class="grid gap-6 xl:grid-cols-2">
        <form class="space-y-4" @submit.prevent="runDiagnostic">
          <div class="grid gap-4 sm:grid-cols-[10rem_1fr]"><UFormField label="Method"><USelect v-model="diagnostic.method" :items="methods" class="w-full" /></UFormField><UFormField label="Absolute URL" required><UInput v-model="diagnostic.url" type="url" class="w-full" placeholder="https://api.example.com/v1/models" /></UFormField></div>
          <UFormField label="Credential" hint="Used for credential proxy selection and $TOKEN$ header replacement"><USelectMenu :model-value="diagnostic.auth_index || noCredentialValue" @update:model-value="diagnostic.auth_index = $event === noCredentialValue ? '' : $event" :items="credentialOptions" value-key="value" label-key="label" class="w-full" :search-input="{ placeholder: 'Search credentials...' }" /></UFormField>
          <UFormField label="Headers (JSON object)"><UTextarea v-model="diagnostic.headers" :rows="6" class="w-full font-mono text-xs" spellcheck="false" /></UFormField>
          <UFormField label="Raw body"><UTextarea v-model="diagnostic.data" :rows="6" class="w-full font-mono text-xs" spellcheck="false" /></UFormField>
          <UAlert v-if="diagnosticError" color="error" variant="subtle" :description="diagnosticError" />
          <div class="flex justify-end"><UButton type="submit" icon="i-tabler-send" :loading="diagnosticLoading">Run request</UButton></div>
        </form>
        <div v-if="diagnosticResult" class="space-y-4"><div class="flex items-center justify-between"><h3 class="font-semibold">Response</h3><UBadge :color="statusColor(diagnosticResult.status_code)" variant="subtle">HTTP {{ diagnosticResult.status_code }}</UBadge></div><div><p class="mb-2 text-xs font-semibold uppercase text-[var(--ui-text-muted)]">Headers</p><pre class="max-h-48 overflow-auto rounded-lg bg-[var(--ui-bg-muted)] p-4 text-xs">{{ JSON.stringify(diagnosticResult.header || {}, null, 2) }}</pre></div><div><div class="mb-2 flex items-center justify-between"><p class="text-xs font-semibold uppercase text-[var(--ui-text-muted)]">Body</p><UButton size="xs" color="neutral" variant="ghost" icon="i-tabler-clipboard" @click="copyDiagnosticBody">Copy</UButton></div><pre class="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--ui-bg-muted)] p-4 text-xs">{{ diagnosticBody }}</pre></div></div>
        <div v-else class="flex min-h-72 flex-col items-center justify-center text-center text-[var(--ui-text-muted)]"><UIcon name="i-tabler-terminal-2" class="size-9" /><p class="mt-3 text-sm">Run a request to inspect status, headers, and body.</p></div>
      </div>
    </UCard>
  </div>
</template>

<script setup>
const { fetchAPI } = useApi()
const toast = useToast()
const nodeName = ref('')
const generating = ref(false)
const errorMessage = ref('')
const enrollment = ref(null)
const authResponse = ref(null)
const diagnosticLoading = ref(false)
const diagnosticError = ref('')
const diagnosticResult = ref(null)
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const diagnostic = reactive({ method: 'GET', url: '', auth_index: '', headers: '{\n  "Accept": "application/json"\n}', data: '' })
const credentials = computed(() => Array.isArray(authResponse.value?.files) ? authResponse.value.files : [])
const noCredentialValue = '__no_credential__'
const credentialOptions = computed(() => [{ label: 'No credential', value: noCredentialValue }, ...credentials.value.map(item => ({ value: item.auth_index || item.id, label: `${item.label || item.name || item.id} · ${item.provider || item.type || 'credential'}` }))])
const diagnosticBody = computed(() => { const body = diagnosticResult.value?.body || ''; try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body } })
const message = (error, fallback) => error?.data?.message || error?.data?.error || error?.message || fallback
async function generateEnrollment() {
  generating.value = true; errorMessage.value = ''; enrollment.value = null
  try {
    enrollment.value = await fetchAPI('/certificates/clients', { method: 'POST', body: { node_name: nodeName.value.trim() } })
    toast.add({ title: 'Enrollment generated', color: 'success', icon: 'i-tabler-circle-check' })
  } catch (error) { errorMessage.value = message(error, 'Unable to generate client enrollment.') }
  finally { generating.value = false }
}
async function copyJWT() {
  if (!enrollment.value?.home_jwt) return
  await navigator.clipboard.writeText(enrollment.value.home_jwt)
  toast.add({ title: 'Enrollment JWT copied', color: 'success' })
}
function statusColor(status) { if (status >= 200 && status < 300) return 'success'; if (status >= 400) return 'error'; return 'warning' }
async function loadCredentials() { try { authResponse.value = await fetchAPI('/auth-files') } catch { authResponse.value = { files: [] } } }
async function runDiagnostic() {
  diagnosticError.value = ''; diagnosticResult.value = null
  if (!diagnostic.url.trim()) { diagnosticError.value = 'An absolute URL is required.'; return }
  let headers
  try { headers = JSON.parse(diagnostic.headers || '{}'); if (!headers || Array.isArray(headers) || typeof headers !== 'object' || Object.values(headers).some(value => typeof value !== 'string')) throw new Error() }
  catch { diagnosticError.value = 'Headers must be a JSON object with string values.'; return }
  diagnosticLoading.value = true
  try { diagnosticResult.value = await fetchAPI('/api-call', { method: 'POST', body: { auth_index: diagnostic.auth_index || undefined, method: diagnostic.method, url: diagnostic.url.trim(), header: headers, data: diagnostic.data } }) }
  catch (error) { diagnosticError.value = message(error, 'The diagnostic request failed.') }
  finally { diagnosticLoading.value = false }
}
async function copyDiagnosticBody() { await navigator.clipboard.writeText(diagnosticResult.value?.body || ''); toast.add({ title: 'Response body copied', color: 'success' }) }
onMounted(loadCredentials)
</script>
