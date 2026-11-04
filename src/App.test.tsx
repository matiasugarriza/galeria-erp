import { fireEvent, render, screen } from '@testing-library/react'
import { listImages } from './services/storageService'
import type { ImageItem } from './types/gallery'
import App from './App'

vi.mock('./services/storageService', () => ({
  listImages: vi.fn(),
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
}))

const standaloneItem: ImageItem = {
  id: 'avatares/avatar-1.jpg',
  name: 'avatar-1.jpg',
  url: 'https://example.com/avatar-1.jpg',
  fullPath: 'avatares/avatar-1.jpg',
  createdAt: '2026-01-01T00:00:00Z',
}

const erpItem: ImageItem = {
  id: 'migradas/CH-999.jpg',
  name: 'CH-999.jpg',
  url: 'https://example.com/ch-999.jpg',
  fullPath: 'migradas/CH-999.jpg',
  createdAt: '2026-01-02T00:00:00Z',
}

describe('App (demo dual-mode, spec 004 T008)', () => {
  it('opera el mismo código base en modo standalone y modo ERP con callbacks (T008, FR-1)', async () => {
    vi.mocked(listImages).mockImplementation((tag) =>
      Promise.resolve(tag === 'migradas' ? [erpItem] : [standaloneItem]),
    )
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Modo Standalone' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Modo ERP (plugin con props)' })).toBeTruthy()
    await screen.findByRole('img', { name: 'CH-999.jpg' })

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar imagen CH-999.jpg' }))

    expect(await screen.findByText(/Seleccionada: CH-999\.jpg/)).toBeTruthy()
    expect(screen.getByText(/migradas\/CH-999\.jpg/)).toBeTruthy()
  })
})
