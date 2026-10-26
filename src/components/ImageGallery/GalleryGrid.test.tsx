import { render, screen } from '@testing-library/react'
import { GalleryGrid } from './GalleryGrid'
import type { ImageItem } from '../../types/gallery'

const items: ImageItem[] = [
  {
    id: 'productos/CH-001.jpg',
    name: 'CH-001.jpg',
    url: 'https://example.com/ch-001.jpg',
    fullPath: 'productos/CH-001.jpg',
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'productos/CH-002_2.jpg',
    name: 'CH-002_2.jpg',
    url: 'https://example.com/ch-002-2.jpg',
    fullPath: 'productos/CH-002_2.jpg',
    createdAt: '2026-02-20T10:00:00Z',
  },
]

describe('GalleryGrid', () => {
  it('renderiza una miniatura por imagen con nombre y fecha de creación (AC1)', () => {
    render(<GalleryGrid items={items} />)

    expect(screen.getByRole('img', { name: 'CH-001.jpg' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'CH-002_2.jpg' })).toBeTruthy()
    expect(screen.getByText('CH-001.jpg')).toBeTruthy()

    const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' })
    expect(screen.getByText(dateFormatter.format(new Date('2026-01-15T10:00:00Z')))).toBeTruthy()
    expect(screen.getByText(dateFormatter.format(new Date('2026-02-20T10:00:00Z')))).toBeTruthy()
  })

  it('las miniaturas son botones accesibles con aria-label', () => {
    render(<GalleryGrid items={items} />)

    expect(screen.getByRole('button', { name: 'Seleccionar imagen CH-001.jpg' })).toBeTruthy()
  })

  it('invoca onSelect con el ImageItem completo al hacer clic (costura de la feature 004)', () => {
    const onSelect = vi.fn()
    render(<GalleryGrid items={items} onSelect={onSelect} />)

    screen.getByRole('button', { name: 'Seleccionar imagen CH-001.jpg' }).click()

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(items[0])
  })
})
