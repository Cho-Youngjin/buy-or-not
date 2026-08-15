import { normalizeMeasurementKey, isStandardKey } from '@/lib/musinsa/measurements'
import type { SizeTable } from '@/lib/musinsa/types'

export type PasteParseResult = {
  table: SizeTable
  unrecognizedHeaders: string[]
}

/**
 * 사용자가 무신사 "사이즈" 탭에서 복사해 붙여넣은 내용을 실측표로 바꾼다.
 * html(clipboardData의 text/html)이 있으면 <table> 구조를 그대로 써서 셀 경계가 정확하고,
 * 없으면(모바일 등) plainText를 줄바꿈·탭 기준으로 나눠 폴백한다.
 */
export function parsePastedSizeTable(html: string | null, plainText: string): PasteParseResult {
  const rows = html ? rowsFromHtml(html) : rowsFromPlainText(plainText)
  return buildTable(rows)
}

function rowsFromHtml(html: string): string[][] {
  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []
  return rowMatches
    .map((rowHtml) => {
      const cellMatches = rowHtml.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []
      return cellMatches.map(stripTags)
    })
    .filter((row) => row.some((cell) => cell.length > 0))
}

function stripTags(fragment: string): string {
  return fragment.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
}

function rowsFromPlainText(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const cells = line.includes('\t') ? line.split(/\t+/) : line.split(/ {2,}/)
      return cells.map((cell) => cell.trim())
    })
    .filter((row) => row.some((cell) => cell.length > 0))
}

function buildTable(rows: string[][]): PasteParseResult {
  const headerRow = rows.find((row) => row.filter((c) => c.length > 0).length >= 2)
  if (!headerRow) return { table: {}, unrecognizedHeaders: [] }

  const keys = headerRow.slice(1).map(normalizeMeasurementKey)
  const unrecognizedHeaders = keys.filter((key) => key.length > 0 && !isStandardKey(key))

  const table: SizeTable = {}
  for (const row of rows) {
    if (row === headerRow) continue
    const sizeLabel = row[0]
    if (!sizeLabel) continue

    const entry: Record<string, number> = {}
    keys.forEach((key, index) => {
      const raw = row[index + 1]
      if (!raw) return
      const value = Number(raw.replace(/[^\d.]/g, ''))
      if (Number.isFinite(value) && value > 0) entry[key] = value
    })
    if (Object.keys(entry).length > 0) table[sizeLabel] = entry
  }

  return { table, unrecognizedHeaders }
}
