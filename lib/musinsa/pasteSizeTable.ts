import { normalizeMeasurementKey, isStandardKey } from '@/lib/musinsa/measurements'
import type { SizeTable } from '@/lib/musinsa/types'

export type PasteParseResult = {
  table: SizeTable
  unrecognizedHeaders: string[]
}

/**
 * 사용자가 무신사 "사이즈" 탭에서 복사해 붙여넣은 내용을 실측표로 바꾼다.
 * html(clipboardData의 text/html)이 있으면 <table>·<li> 구조를 그대로 써서 셀 경계가 정확하고,
 * 없으면(모바일 등) plainText를 줄바꿈·탭 기준으로 나눠 폴백한다.
 *
 * 실제 무신사 페이지를 복사해 테스트해보니(2026-08-15), 사이즈 라벨(cm/내 사이즈/M/L/XL)과
 * 측정값은 하나의 <table>이 아니라 서로 다른 두 DOM(라벨은 <ul><li>로 만든 고정 열, 측정값만
 * <table>)으로 나뉘어 있었다 — 폭이 넓어질 수 있는 표의 첫 열을 고정하기 위한 구조로 보인다.
 * 그래서 <table>의 헤더 행에는 라벨 칸이 아예 없고, 데이터 행도 사이즈명 없이 숫자만 있다.
 * buildTable은 이 구조를 그대로 반영해 "라벨 목록"과 "측정 헤더+데이터 행"을 따로 모은 뒤
 * 뒤에서부터(cm·내 사이즈 같은 비-사이즈 라벨을 자연히 걸러내며) 순서대로 짝짓는다.
 */
export function parsePastedSizeTable(html: string | null, plainText: string): PasteParseResult {
  const rows = html ? rowsFromHtml(html) : rowsFromPlainText(plainText)
  return buildTable(rows)
}

// <tr>뿐 아니라 <li>(사이즈 라벨 고정 열)도 문서 순서 그대로 잡아야 라벨과 측정값이 밀리지 않는다.
function rowsFromHtml(html: string): string[][] {
  const blocks = html.match(/<li[\s\S]*?<\/li>|<tr[\s\S]*?<\/tr>/gi) ?? []
  return blocks
    .map((block): string[] => {
      if (/^<li/i.test(block)) {
        const text = stripTags(block)
        return text ? [text] : []
      }
      const cellMatches = block.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []
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
  const headerIndex = rows.findIndex((row) => row.filter((c) => c.length > 0).length >= 2)
  if (headerIndex === -1) return { table: {}, unrecognizedHeaders: [] }

  const headerRow = rows[headerIndex]
  const keys = headerRow.map(normalizeMeasurementKey)
  const unrecognizedHeaders = keys.filter((key) => key.length > 0 && !isStandardKey(key))

  // 사이즈 라벨은 헤더보다 앞에, 한 칸짜리 행으로 나온다(cm, 내 사이즈, M, L, XL …).
  // "cm"·"내 사이즈"처럼 실제 사이즈가 아닌 앞쪽 항목은 뒤에서부터 세어 자연히 제외된다.
  const labelRows = rows
    .slice(0, headerIndex)
    .filter((row) => row.filter((c) => c.length > 0).length === 1)
    .map((row) => row.find((c) => c.length > 0)!)

  // 데이터 행은 헤더와 칸 수가 같고 숫자가 하나라도 있어야 한다 — "사이즈를 직접 입력해주세요"
  // 같은 안내 행(칸 1개)은 이 조건에서 자연히 걸러진다.
  const dataRows = rows
    .slice(headerIndex + 1)
    .filter((row) => row.length === headerRow.length && row.some((c) => /\d/.test(c)))

  const pairCount = Math.min(labelRows.length, dataRows.length)
  const sizeLabels = labelRows.slice(labelRows.length - pairCount)
  const alignedDataRows = dataRows.slice(dataRows.length - pairCount)

  const table: SizeTable = {}
  sizeLabels.forEach((sizeLabel, i) => {
    const row = alignedDataRows[i]
    const entry: Record<string, number> = {}
    keys.forEach((key, index) => {
      const raw = row[index]
      if (!raw) return
      const value = Number(raw.replace(/[^\d.]/g, ''))
      if (Number.isFinite(value) && value > 0) entry[key] = value
    })
    if (Object.keys(entry).length > 0) table[sizeLabel] = entry
  })

  return { table, unrecognizedHeaders }
}
