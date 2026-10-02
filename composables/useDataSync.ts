import { onScopeDispose } from 'vue'
import { useWorkspaceStore } from '~/stores/workspace'

export const useDataSync = (key: string, loader: () => Promise<unknown> | unknown) => {
  const unregister = useWorkspaceStore().registerSync(key, loader)
  onScopeDispose(unregister)
}
