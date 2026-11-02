import { matchesSearch, normalizeSearch } from './searchUtils'

describe('searchUtils', () => {
  it('normaliza con NFKD, elimina diacríticos y pasa a minúsculas (FR-1)', () => {
    expect(normalizeSearch('  PÁSTAÚnica ')).toBe('pastaunica')
  })

  it('encuentra coincidencias sin distinguir mayúsculas ni acentos (FR-1)', () => {
    expect(matchesSearch('CÓDIGO-Á.jpg', 'codigo-a')).toBe(true)
    expect(matchesSearch('CÓDIGO-Á.jpg', 'CODIGO-A')).toBe(true)
    expect(matchesSearch('CÓDIGO-Á.jpg', 'foto')).toBe(false)
  })

  it('la ñ se compara como n por descomposición NFKD (FR-1)', () => {
    expect(matchesSearch('AÑO-2026.jpg', 'ano-2026')).toBe(true)
  })

  it('un término vacío coincide con cualquier nombre (limpiar la búsqueda)', () => {
    expect(matchesSearch('CH-001.jpg', '')).toBe(true)
  })
})
