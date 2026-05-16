const SPREADSHEET_EXTENSIONS = new Set(['xlsx', 'xls', 'csv'])
const PROMPT_COLUMN_LIMIT = 24
const PROMPT_SAMPLE_ROW_LIMIT = 8
const PROMPT_SAMPLE_COLUMN_LIMIT = 12
const PROMPT_VALUE_LIMIT = 80

export async function importSpreadsheetFile(file) {
  if (!file) {
    throw new Error('Please choose an Excel or CSV file.')
  }

  if (!isSupportedSpreadsheetFile(file)) {
    throw new Error('Only .xlsx, .xls, and .csv files can be imported.')
  }

  const XLSX = await loadXLSX()
  const workbook = await readWorkbook(XLSX, file)
  const parsedSheets = workbook.SheetNames.map((sheetName) => ({
    sheetName,
    rows: normalizeRows(
      XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        defval: null,
        raw: true
      })
    )
  }))
  const selectedSheet = parsedSheets.find((sheet) => sheet.rows.length > 0)

  if (!selectedSheet) {
    throw new Error('The selected spreadsheet does not contain any data rows.')
  }

  const columns = inferColumns(selectedSheet.rows)

  return {
    fileName: file.name || 'spreadsheet',
    sheetName: selectedSheet.sheetName,
    rows: selectedSheet.rows,
    columns,
    columnTypes: inferColumnTypes(selectedSheet.rows, columns),
    sheetNames: workbook.SheetNames,
    rowCount: selectedSheet.rows.length
  }
}

export function createSpreadsheetPromptContext(spreadsheet) {
  if (!spreadsheet?.rows?.length) return ''

  const visibleColumns = spreadsheet.columns.slice(0, PROMPT_COLUMN_LIMIT)
  const hiddenColumnCount = Math.max(
    0,
    spreadsheet.columns.length - visibleColumns.length
  )
  const columns = visibleColumns
    .map((column) => {
      const type = spreadsheet.columnTypes?.[column] || 'unknown'
      return `${JSON.stringify(column)} (${type})`
    })
    .join(', ')
  const columnSuffix =
    hiddenColumnCount > 0 ? `, plus ${hiddenColumnCount} more column(s)` : ''
  const sampleRows = createPromptSampleRows(spreadsheet.rows, visibleColumns)

  return [
    `Imported spreadsheet "${spreadsheet.fileName}" sheet "${spreadsheet.sheetName}" has ${spreadsheet.rowCount} row(s).`,
    `Available columns: ${columns}${columnSuffix}.`,
    `Sample rows: ${JSON.stringify(sampleRows)}.`,
    'Use only the imported column names for encodings.',
    'Do not include data arrays in the output; the app will bind the imported rows as root data.'
  ].join(' ')
}

export function formatSpreadsheetSummary(spreadsheet) {
  if (!spreadsheet?.rows?.length) return 'No spreadsheet imported.'

  const visibleColumns = spreadsheet.columns.slice(0, 4)
  const suffix =
    spreadsheet.columns.length > visibleColumns.length
      ? ` +${spreadsheet.columns.length - visibleColumns.length}`
      : ''

  return `${spreadsheet.fileName} / ${spreadsheet.sheetName} / ${spreadsheet.rowCount} rows / ${visibleColumns.join(', ')}${suffix}`
}

function isSupportedSpreadsheetFile(file) {
  const extension = getFileExtension(file.name)
  if (SPREADSHEET_EXTENSIONS.has(extension)) return true

  return [
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ].includes(file.type)
}

async function loadXLSX() {
  const mod = await import('xlsx')
  const candidate = Object.prototype.hasOwnProperty.call(mod, 'default')
    ? mod.default
    : mod
  return candidate?.read ? candidate : mod
}

async function readWorkbook(XLSX, file) {
  const extension = getFileExtension(file.name)
  if (extension === 'csv' || file.type === 'text/csv') {
    return XLSX.read(await readFileText(file), {
      type: 'string',
      cellDates: true
    })
  }

  return XLSX.read(await readFileArrayBuffer(file), {
    type: 'array',
    cellDates: true
  })
}

function readFileArrayBuffer(file) {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer()

  return readWithFileReader(file, 'readAsArrayBuffer')
}

function readFileText(file) {
  if (typeof file.text === 'function') return file.text()

  return readWithFileReader(file, 'readAsText')
}

function readWithFileReader(file, method) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader[method](file)
  })
}

function normalizeRows(rows) {
  return rows
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
    .map((row) => normalizeRow(row))
    .filter((row) => Object.values(row).some(isPresentCellValue))
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [String(key).trim(), value])
  )
}

function inferColumns(rows) {
  const columns = []
  const seen = new Set()

  rows.forEach((row) => {
    Object.keys(row).forEach((column) => {
      if (!column || seen.has(column)) return
      seen.add(column)
      columns.push(column)
    })
  })

  return columns
}

function inferColumnTypes(rows, columns) {
  return Object.fromEntries(
    columns.map((column) => [column, inferColumnType(rows, column)])
  )
}

function inferColumnType(rows, column) {
  const types = new Set(
    rows
      .map((row) => row[column])
      .filter(isPresentCellValue)
      .slice(0, 100)
      .map(getValueType)
  )

  if (types.size === 0) return 'empty'
  if (types.size === 1) return [...types][0]
  if (types.size === 2 && types.has('number') && types.has('date')) {
    return 'date'
  }
  return 'mixed'
}

function getValueType(value) {
  if (value instanceof Date) return 'date'
  if (typeof value === 'number' && Number.isFinite(value)) return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'text'
}

function createPromptSampleRows(rows, columns) {
  const sampleColumns = columns.slice(0, PROMPT_SAMPLE_COLUMN_LIMIT)
  return rows
    .slice(0, PROMPT_SAMPLE_ROW_LIMIT)
    .map((row) =>
      Object.fromEntries(
        sampleColumns.map((column) => [column, formatPromptValue(row[column])])
      )
    )
}

function formatPromptValue(value) {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && value.length > PROMPT_VALUE_LIMIT) {
    return `${value.slice(0, PROMPT_VALUE_LIMIT)}...`
  }
  return value
}

function isPresentCellValue(value) {
  return value !== null && value !== undefined && value !== ''
}

function getFileExtension(fileName = '') {
  return String(fileName).split('.').pop().toLowerCase()
}
