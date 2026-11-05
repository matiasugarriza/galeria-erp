import { fireEvent, render, screen } from '@testing-library/react'
import type { GalleryPhoto } from '../../types/gallery'
import { ImageModal } from './ImageModal'

const formatFecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' })

const item: GalleryPhoto = {
  id: 'migradas__CH-001',
  codigo: 'CH-001',
  nombre: 'CH-001.png',
  carpeta: 'migradas',
  url: 'https://example.com/CH-001.webp',
  thumbUrl: 'https://example.com/thumbs/CH-001.webp',
  fullPath: 'migradas/CH-001.webp',
  vista: 'frente',
  origen: 'corel',
  basadaEn: null,
  estado: 'aprobada',
  creadoEn: new Date('2026-01-15T10:00:00Z'),
}

describe('ImageModal', () => {
  it('muestra la imagen grande, el nombre, el código y la fecha (FR-10)', () => {
    render(<ImageModal foto={item} onClose={vi.fn()} />)

    const imagen = screen.getByRole('img', { name: 'CH-001.png' })
    expect(imagen.getAttribute('src')).toBe('https://example.com/CH-001.webp')
    expect(imagen.getAttribute('loading')).not.toBe('lazy')
    expect(screen.getByText('CH-001.png')).toBeTruthy()
    expect(screen.getByText('CH-001')).toBeTruthy()
    expect(screen.getByText(formatFecha.format(item.creadoEn))).toBeTruthy()
  })

  it('no expone el id ni el fullPath del documento como texto (FR-10)', () => {
    render(<ImageModal foto={item} onClose={vi.fn()} />)

    expect(screen.queryByText('migradas__CH-001')).toBeNull()
    expect(screen.queryByText('migradas/CH-001.webp')).toBeNull()
  })

  it('se cierra con el botón accesible (FR-10)', () => {
    const onClose = vi.fn()
    render(<ImageModal foto={item} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar vista previa' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('se cierra con la tecla Escape (FR-10)', () => {
    const onClose = vi.fn()
    render(<ImageModal foto={item} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('se cierra al hacer clic fuera del contenido pero no dentro (FR-10)', () => {
    const onClose = vi.fn()
    render(<ImageModal foto={item} onClose={onClose} />)

    fireEvent.click(screen.getByRole('img', { name: 'CH-001.png' }))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('dialog', { name: 'Vista previa de CH-001.png' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
