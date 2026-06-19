import { test, expect } from '@playwright/test'

const API = `http://localhost:${process.env.FM_API_PORT || 8000}`

async function fileCount(folder = ''): Promise<number> {
  const res = await fetch(`${API}/api/files?folder=${folder}`)
  return ((await res.json()) as unknown[]).length
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('opens the library and lists seeded files', async ({ page }) => {
  await page.getByRole('button', { name: 'Open library (manage)' }).click()
  const fm = page.locator('file-manager')
  await expect(fm.locator('.item').first()).toBeVisible()
  expect(await fm.locator('.item').count()).toBeGreaterThanOrEqual(3)
  // folder tree shows the seeded "products" folder
  await expect(fm.getByRole('button', { name: /products/i })).toBeVisible()
})

test('non-image files render typed extension icons', async ({ page }) => {
  await page.getByRole('button', { name: 'Open library (manage)' }).click()
  const fm = page.locator('file-manager')
  await fm.getByRole('button', { name: /docs/i }).click()
  await expect(fm.locator('.file-glyph').first()).toBeVisible()
  await expect(fm.getByText('PDF', { exact: true })).toBeVisible()
  await expect(fm.getByText('MP4', { exact: true })).toBeVisible()
})

test('single selection writes the chosen url into the bound input', async ({ page }) => {
  await page.locator('[data-open-file-manager="#legacy"]').click()
  const fm = page.locator('file-manager')
  await fm.locator('.item').first().click()
  await expect(page.locator('#legacy')).toHaveValue(/\/uploads\/.+\.(jpg|png)$/)
})

test('cropping produces a new derivative file (server-side)', async ({ page }) => {
  const before = await fileCount()
  await page.getByRole('button', { name: 'openFileManager()' }).click()
  const fm = page.locator('file-manager')
  await fm.locator('.item').first().hover()
  await fm.getByTitle('Crop').first().click()
  // cropperjs builds its own UI container once the source image has loaded
  await expect(fm.locator('.cropper-container')).toBeVisible()
  await fm.getByRole('button', { name: 'Apply crop' }).click()
  await expect.poll(async () => fileCount(), { timeout: 8000 }).toBe(before + 1)
  // single-pick mode auto-selects the derivative → resolves the promise
  await expect(page.locator('#out')).toContainText(/uploads\/.+-\d+x\d+\./)
})

test('multiple selection renders chips that submit name[]', async ({ page }) => {
  await page.locator('.fm-add').click()
  const fm = page.locator('file-manager')
  await expect(fm.locator('.item').first()).toBeVisible()
  await fm.locator('.item').nth(0).click()
  await fm.locator('.item').nth(1).click()
  await fm.getByRole('button', { name: /Insert 2 files/ }).click()
  const chips = page.locator('.fm-chips .fm-chip')
  await expect(chips).toHaveCount(2)
  await expect(page.locator('.fm-chips input[name="gallery[]"]')).toHaveCount(2)
})

// Fire a full HTML5 drag sequence on real nodes inside the shadow root.
function dndDispatch(arg: { sourceSel: string; targetText: string }): void {
  const root = (document.querySelector('file-manager') as unknown as { shadowRoot: ShadowRoot })
    .shadowRoot
  const source = root.querySelector(arg.sourceSel)!
  // folder names now render inside <fm-trunc> (shadow DOM), so the button text is
  // empty — match the button's aria-label (full name), falling back to textContent.
  const target = [...root.querySelectorAll('.sidebar button, .tree button')].find((b) =>
    new RegExp(arg.targetText, 'i').test(b.getAttribute('aria-label') || b.textContent || ''),
  )!
  const dt = new DataTransfer()
  const fire = (el: Element, type: string) =>
    el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }))
  fire(source, 'dragstart')
  fire(target, 'dragenter')
  fire(target, 'dragover')
  fire(target, 'drop')
}

test('drag a file onto a folder moves it (internal DnD)', async ({ page }) => {
  await page.getByRole('button', { name: 'Open library (manage)' }).click()
  const fm = page.locator('file-manager')
  await expect(fm.locator('.item').first()).toBeVisible()
  const before = await fileCount('products')
  await page.evaluate(dndDispatch, { sourceSel: '.item', targetText: 'products' })
  await expect.poll(async () => fileCount('products'), { timeout: 6000 }).toBe(before + 1)
})

test('dragging several selected files shows a count badge and moves them all', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Open library (manage)' }).click()
  const fm = page.locator('file-manager')
  await expect(fm.locator('.item').first()).toBeVisible()
  test.skip((await fileCount('')) < 2, 'needs >= 2 root files')
  await fm.locator('.item').nth(0).click()
  await fm.locator('.item').nth(1).click()
  const before = await fileCount('products')
  const ghostText = await page.evaluate(() => {
    const root = (document.querySelector('file-manager') as unknown as { shadowRoot: ShadowRoot })
      .shadowRoot
    const item = root.querySelector('.item')!
    const products = [...root.querySelectorAll('.tree button')].find((b) =>
      /products/i.test(b.getAttribute('aria-label') || b.textContent || ''),
    )!
    const dt = new DataTransfer()
    const fire = (el: Element, t: string) =>
      el.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }))
    fire(item, 'dragstart')
    const ghost = document.querySelector('.fm-drag-ghost')?.textContent ?? ''
    fire(products, 'dragover')
    fire(products, 'drop')
    return ghost
  })
  expect(ghostText).toContain('2')
  await expect.poll(async () => fileCount('products'), { timeout: 6000 }).toBe(before + 2)
})

test('dropping a file on "New folder" creates a folder and moves it in', async ({ page }) => {
  const foldersBefore = await (await fetch(`${API}/api/folders`)).json()
  await page.getByRole('button', { name: 'Open library (manage)' }).click()
  const fm = page.locator('file-manager')
  await expect(fm.locator('.item').first()).toBeVisible()
  await page.evaluate(dndDispatch, { sourceSel: '.item', targetText: 'new folder' })
  // a themed PROMPT dialog appears (not a native prompt)
  await expect(fm.locator('.dialog-box input')).toBeVisible()
  await fm.locator('.dialog-box input').fill('dropped-set')
  await fm.locator('.dialog-box').getByRole('button', { name: 'Confirm' }).click()
  await expect
    .poll(async () => (await (await fetch(`${API}/api/folders`)).json()).length, { timeout: 6000 })
    .toBe(foldersBefore.length + 1)
  // and we are now INSIDE the new folder, which holds the dropped file
  await expect(fm.locator('.breadcrumb').getByRole('button', { name: /dropped-set/ })).toBeVisible()
  await expect(fm.locator('.item')).toHaveCount(1)
})

test('dropping a Finder folder imports its files recursively (structure preserved)', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Open library (manage)' }).click()
  const fm = page.locator('file-manager')
  await expect(fm.locator('.modal')).toBeVisible()
  await page.evaluate(async () => {
    const el = document.querySelector('file-manager') as unknown as {
      importEntries: (e: unknown[]) => Promise<void>
    }
    const mkFile = (name: string) => new File(['data'], name, { type: 'image/jpeg' })
    const fileEntry = (name: string) => ({
      isFile: true,
      isDirectory: false,
      name,
      file: (cb: (f: File) => void) => cb(mkFile(name)),
    })
    const dirEntry = (name: string, children: unknown[]) => ({
      isFile: false,
      isDirectory: true,
      name,
      createReader: () => {
        let done = false
        return {
          readEntries: (cb: (b: unknown[]) => void) => {
            const batch = done ? [] : children
            done = true
            // real readEntries is async; defer so the mock can't recurse synchronously
            setTimeout(() => cb(batch), 0)
          },
        }
      },
    })
    const tree = dirEntry('imported-album', [
      fileEntry('a.jpg'),
      fileEntry('b.jpg'),
      dirEntry('sub', [fileEntry('c.jpg')]),
    ])
    await el.importEntries([tree])
  })

  const folders = await (await fetch(`${API}/api/folders`)).json()
  const album = folders.find(
    (f: { name: string; parent: string | null }) =>
      /^imported-album/.test(f.name) && f.parent === null,
  )
  expect(album).toBeTruthy()
  const albumFiles = await (await fetch(`${API}/api/files?folder=${album.id}`)).json()
  expect(albumFiles.length).toBe(2)
  const sub = folders.find((f: { parent: string | null }) => f.parent === album.id)
  expect(sub).toBeTruthy()
  const subFiles = await (await fetch(`${API}/api/files?folder=${sub.id}`)).json()
  expect(subFiles.length).toBe(1)
  // and the manager stepped into the imported folder
  await expect(
    fm.locator('.breadcrumb').getByRole('button', { name: /imported-album/ }),
  ).toBeVisible()
})

test('creating a folder via the button steps into it', async ({ page }) => {
  await page.getByRole('button', { name: 'Open library (manage)' }).click()
  const fm = page.locator('file-manager')
  await fm.getByRole('button', { name: /New folder/ }).click()
  await fm.locator('.dialog-box input').fill('fresh-folder')
  await fm.locator('.dialog-box').getByRole('button', { name: 'Confirm' }).click()
  await expect(fm.locator('.breadcrumb').getByRole('button', { name: /fresh-folder/ })).toBeVisible()
  await expect(fm.getByText('This folder is empty')).toBeVisible()
})

test('delete uses a themed dialog, never a native confirm', async ({ page }) => {
  page.on('dialog', () => {
    throw new Error('a native dialog appeared')
  })
  await page.getByRole('button', { name: 'Open library (manage)' }).click()
  const fm = page.locator('file-manager')
  const item = fm.locator('.item').first()
  await item.hover()
  await item.getByTitle('Delete').click()
  await expect(fm.locator('.dialog-box')).toBeVisible()
  await expect(fm.locator('.dialog-box')).toContainText('Delete')
  await fm.locator('.dialog-box').getByRole('button', { name: 'Cancel' }).click()
  await expect(fm.locator('.dialog-box')).toHaveCount(0)
})

test('opens in French when lang is set (runtime i18n)', async ({ page }) => {
  await page.getByRole('button', { name: 'Ouvrir en français' }).click()
  const fm = page.locator('file-manager')
  await expect(fm.locator('header h2')).toHaveText('Médiathèque')
  await expect(fm.getByText('Téléverser')).toBeVisible()
})

test('adopts the active daisyUI theme (token bridge)', async ({ page }) => {
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dim'))
  await page.getByRole('button', { name: 'Open library (manage)' }).click()
  const modal = page.locator('file-manager').locator('.modal')
  await expect(modal).toBeVisible()
  // --color-base-100 of "dim" is #2a303c → the modal surface must be dark
  const bg = await modal.evaluate((el) => getComputedStyle(el).backgroundColor)
  const [r, g, b] = bg.match(/\d+/g)!.map(Number)
  expect(r + g + b).toBeLessThan(180) // clearly dark
})
