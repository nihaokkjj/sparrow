import { beforeEach, expect, test, vi } from 'vitest'

const xlsxMocks = vi.hoisted(() => ({
  read: vi.fn(),
  sheet_to_json: vi.fn()
}))

vi.mock('xlsx', () => ({
  read: xlsxMocks.read,
  utils: {
    sheet_to_json: xlsxMocks.sheet_to_json
  }
}))

beforeEach(() => {
  xlsxMocks.read.mockReset()
  xlsxMocks.sheet_to_json.mockReset()
})

test('importSpreadsheetFile reads the first non-empty Excel sheet', async () => {
  const { createSpreadsheetPromptContext, importSpreadsheetFile } =
    await import('../../src/playground/importSpreadsheet.js')
  const workbook = {
    SheetNames: ['Empty', 'Sales'],
    Sheets: {
      Empty: { id: 'empty' },
      Sales: { id: 'sales' }
    }
  }
  const rows = [
    { region: 'East', sales: 12, date: new Date('2026-01-01') },
    { region: '', sales: null, date: null },
    { region: 'West', sales: 18, date: new Date('2026-02-01') }
  ]

  xlsxMocks.read.mockReturnValue(workbook)
  xlsxMocks.sheet_to_json.mockImplementation((sheet) =>
    sheet.id === 'sales' ? rows : []
  )

  const result = await importSpreadsheetFile(
    new File(['demo'], 'sales.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
  )

  expect(xlsxMocks.read).toHaveBeenCalledWith(
    expect.any(ArrayBuffer),
    expect.objectContaining({ type: 'array', cellDates: true })
  )
  expect(result.sheetName).toBe('Sales')
  expect(result.rows).toEqual([rows[0], rows[2]])
  expect(result.columns).toEqual(['region', 'sales', 'date'])
  expect(result.columnTypes).toEqual({
    region: 'text',
    sales: 'number',
    date: 'date'
  })
  expect(createSpreadsheetPromptContext(result)).toContain('"sales" (number)')
})

test('importSpreadsheetFile rejects unsupported files', async () => {
  const { importSpreadsheetFile } =
    await import('../../src/playground/importSpreadsheet.js')

  await expect(
    importSpreadsheetFile(
      new File(['demo'], 'notes.txt', { type: 'text/plain' })
    )
  ).rejects.toThrow('Only .xlsx, .xls, and .csv files can be imported.')
})
