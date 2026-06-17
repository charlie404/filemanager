// Dev harness entry — registers the element, wires declarative fields, and
// demonstrates the programmatic API.
import { FileManager, bindFileManagers, openFileManager } from './index'

FileManager.register('file-manager', { endpoint: '/api' })
bindFileManagers()

const out = document.querySelector<HTMLPreElement>('#out')!

document.querySelector('#prog')?.addEventListener('click', async () => {
  const fm = document.querySelector<FileManager>('file-manager')!
  fm.lang = '' // follow <html lang> (English here)
  try {
    const url = await openFileManager({ accept: 'image/*' })
    out.textContent = `openFileManager() resolved:\n${url}`
  } catch {
    out.textContent = '// cancelled'
  }
})

// Open the manager in French — the dict re-resolves reactively from `lang`.
document.querySelector('#fr')?.addEventListener('click', () => {
  const fm = document.querySelector<FileManager>('file-manager')!
  fm.lang = 'fr'
  fm.show({ pick: false })
})
