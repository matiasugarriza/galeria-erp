import { fireEvent, render, screen } from '@testing-library/react'
import type { GalleryPhoto } from '../../types/gallery'
import { GalleryGrid } from './GalleryGrid'

const formatFecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' })

function foto(overrides: Partial<GalleryPhoto> = {}): GalleryPhoto {
  return {
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
    ...overrides,
  }
}

describe('GalleryGrid', () => {
  it('renderiza la miniatura con loading lazy y respaldo único a la imagen completa (FR-4, FR-5)', () => {
    const item = foto()
    render(<GalleryGrid fotos={[item]} />)

    const imagen = screen.getByRole('img', { name: 'CH-001.png' })
    expect(imagen.getAttribute('src')).toBe('https://example.com/thumbs/CH-001.webp')
    expect(imagen.getAttribute('loading')).toBe('lazy')

    fireEvent.error(imagen)
    expect(imagen.getAttribute('src')).toBe('https://example.com/CH-001.webp')

    // Un segundo error no vuelve a disparar el respaldo (sin bucles).
    fireEvent.error(imagen)
    expect(imagen.getAttribute('src')).toBe('https://example.com/CH-001.webp')
  })

  it('muestra nombre, fecha de creación y código de la foto', () => {
    render(<GalleryGrid fotos={[foto()]} />)

    expect(screen.getByText('CH-001.png')).toBeTruthy()
    expect(screen.getByText(formatFecha.format(new Date('2026-01-15T10:00:00Z')))).toBeTruthy()
    expect(screen.getByText('CH-001')).toBeTruthy()
  })

  it('abre la vista previa al tocar la imagen y no al tildar (FR-10, FR-11)', () => {
    const item = foto()
    const onPreview = vi.fn()
    const onToggleSeleccion = vi.fn()
    render(
      <GalleryGrid fotos={[item]} onPreview={onPreview} onToggleSeleccion={onToggleSeleccion} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ampliar CH-001.png' }))
    expect(onPreview).toHaveBeenCalledWith(item)
    expect(onPreview).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Tildar CH-001.png' }))
    expect(onToggleSeleccion).toHaveBeenCalledWith(item)
    expect(onPreview).toHaveBeenCalledTimes(1)
  })

  it('bloquea el tilde de las fotos para revisar y muestra la leyenda (FR-11)', () => {
    render(<GalleryGrid fotos={[foto({ estado: 'para_revisar' })]} onToggleSeleccion={vi.fn()} />)

    const tilde = screen.getByRole('checkbox', { name: 'Tildar CH-001.png' }) as HTMLInputElement
    expect(tilde.disabled).toBe(true)
    expect(screen.getByText('Para revisar')).toBeTruthy()
  })

  it('refleja la selección y la oculta junto con el borrado en readOnly (FR-11)', () => {
    const item = foto()
    const { rerender } = render(
      <GalleryGrid fotos={[item]} seleccionadas={new Set([item.id])} onDelete={vi.fn()} />,
    )

    const tilde = screen.getByRole('checkbox', { name: 'Tildar CH-001.png' }) as HTMLInputElement
    expect(tilde.checked).toBe(true)

    rerender(<GalleryGrid fotos={[item]} readOnly onDelete={vi.fn()} />)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Eliminar CH-001.png' })).toBeNull()
  })

  it('sólo muestra el botón de eliminar cuando se pasa onDelete (FR-16)', () => {
    const item = foto()
    const { rerender } = render(<GalleryGrid fotos={[item]} />)
    expect(screen.queryByRole('button', { name: 'Eliminar CH-001.png' })).toBeNull()

    const onDelete = vi.fn()
    rerender(<GalleryGrid fotos={[item]} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar CH-001.png' }))

    expect(onDelete).toHaveBeenCalledWith(item)
  })
})
