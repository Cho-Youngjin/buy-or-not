'use client'

import { useState } from 'react'
import { parsePastedSizeTable } from '@/lib/musinsa/pasteSizeTable'
import type { SizeTable } from '@/lib/musinsa/types'

type Props = {
  onParsed: (table: SizeTable) => void
}

/**
 * Phase 0 조사에서 실측표는 정적 HTML/내부 API 어디서도 얻을 수 없다고 확인됐다(README 참고).
 * 그래서 사용자가 무신사 "사이즈" 탭 표를 직접 복사해 붙여넣으면, 클립보드의 text/html을
 * 우선 파싱하고(테이블 셀 경계가 정확함) 없으면 text/plain으로 폴백한다(lib/musinsa/pasteSizeTable.ts).
 */
export function PasteSizeTableField({ onParsed }: Props) {
  const [text, setText] = useState('')
  const [table, setTable] = useState<SizeTable>({})
  const [unrecognizedHeaders, setUnrecognizedHeaders] = useState<string[]>([])
  const [attempted, setAttempted] = useState(false)

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const html = event.clipboardData.getData('text/html') || null
    const plain = event.clipboardData.getData('text/plain')
    const result = parsePastedSizeTable(html, plain)

    setTable(result.table)
    setUnrecognizedHeaders(result.unrecognizedHeaders)
    setAttempted(true)
    onParsed(result.table)
  }

  const recognizedSizes = Object.keys(table)

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600">
        무신사 &quot;사이즈&quot; 탭에서 표 전체(헤더 행부터 사이즈 행까지)를 드래그해 복사한 뒤 아래에 붙여넣어주세요.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={handlePaste}
        rows={4}
        placeholder="여기에 붙여넣기 (Ctrl+V)"
        className="w-full rounded border px-3 py-2 font-mono text-sm"
      />
      {attempted && recognizedSizes.length > 0 && (
        <ul className="rounded bg-green-50 p-2 text-sm text-green-800">
          {recognizedSizes.map((size) => (
            <li key={size}>
              {size}: {Object.entries(table[size]).map(([key, value]) => `${key} ${value}`).join(', ')}
            </li>
          ))}
        </ul>
      )}
      {attempted && recognizedSizes.length === 0 && (
        <p className="text-sm text-red-600">
          표를 인식하지 못했습니다. 다시 복사해서 붙여넣거나, 아래 직접 입력을 이용해주세요.
        </p>
      )}
      {unrecognizedHeaders.length > 0 && (
        <p className="text-xs text-gray-500">인식 못 한 항목: {unrecognizedHeaders.join(', ')}</p>
      )}
    </div>
  )
}
