'use client'

import { useState } from 'react'
import { CATEGORY_LABELS, type Category } from '@/lib/types'
import { PARSEABLE_FIELDS, type ParseResult, type ParseableField, type SizeTable } from '@/lib/musinsa/types'
import { STANDARD_KEYS } from '@/lib/musinsa/measurements'
import { FIT_RULES } from '@/lib/fit/rules'
import { PasteSizeTableField } from '@/components/garment/PasteSizeTableField'
import { Button } from '@/components/ui/Button'
import { INPUT, CARD_SURFACE } from '@/components/ui/styles'

export type GarmentSubmitPayload = {
  goodsNo: string
  sourceUrl: string
  name: string
  brand: string | null
  price: number | null
  imageUrl: string | null
  category: Category
  colorOption: string
  sizeOption: string
  measurements: Record<string, number>
  /** 붙여넣기로 얻은 사이즈×항목 전체 매트릭스. Task 11이 musinsa_cache에 반영한다. 못 얻었으면 null. */
  fullSizeTable: SizeTable | null
  manualFields: ParseableField[]
}

type Props = {
  parsed: ParseResult
  sourceUrl: string
  /** 옷장 등록은 '/api/garments', 구매 판단은 '/api/analyze' — 등록 파이프라인은 같고 목적지만 다르다. */
  submitEndpoint: string
  submitLabel: string
  onSubmitted: (result: Record<string, unknown>) => void
  /** 추천 등록(RecommendLinkBar)에서만 켠다 — 코멘트 입력칸을 추가로 보여준다. */
  noteField?: boolean
  /** 요청 바디에 합쳐 보낼 필드(예: wardrobeOwnerId). 옷장 등록·구매 판단에서는 비워둔다. */
  extraBody?: Record<string, unknown>
  /** 넘기면 폼 우측 상단에 "접기" 버튼이 생긴다. 링크를 잘못 넣었을 때 폼을 닫는 용도. */
  onCancel?: () => void
}

/**
 * 필드별 파싱 성공/실패(ParseResult.fields)에 따라 입력칸을 나눠 그린다 —
 * 성공한 필드는 읽기전용으로 잠기고, 실패한 필드만 사용자가 채운다(스펙의 "필드 단위 파싱 실패" 원칙).
 * options·sizeTable은 Task 5에서 애초에 자동 파싱을 시도하지 않으므로 항상 manualFields에 포함된다.
 * 옷장 등록(LinkInputBar)과 구매 판단(AnalyzeLinkBar)이 이 폼을 그대로 공유한다 — 파싱·검증 UX가
 * 갈라지면 무신사 개편 대응이나 실측 입력 로직을 두 곳에서 따로 관리해야 한다.
 */
export function GarmentForm({
  parsed, sourceUrl, submitEndpoint, submitLabel, onSubmitted, noteField, extraBody, onCancel,
}: Props) {
  const f = parsed.fields

  const manualFields = PARSEABLE_FIELDS.filter((key) => !f[key].ok)

  const [name, setName] = useState(f.name.ok ? f.name.value : '')
  const [brand, setBrand] = useState(f.brand.ok ? f.brand.value : '')
  const [price, setPrice] = useState(f.price.ok ? String(f.price.value) : '')
  const [imageUrl, setImageUrl] = useState(f.imageUrl.ok ? f.imageUrl.value : '')
  // 카테고리 파싱에 실패하면 'top' 대신 'acc'를 기본값으로 둔다 — 잘못 등록된 액세서리가
  // 최악의 경우에도 핏 판단(FIT_RULES에 없는 카테고리는 채점 자체를 건너뜀)을 오염시키지 않는다.
  const [category, setCategory] = useState<Category>(f.category.ok ? f.category.value : 'acc')

  const colors = f.options.ok ? f.options.value.colors : []
  const sizes = f.options.ok ? f.options.value.sizes : []

  const [color, setColor] = useState(colors[0] ?? '')
  const [size, setSize] = useState(sizes[0] ?? '')
  const [pastedSizeTable, setPastedSizeTable] = useState<SizeTable>({})
  const [manualMeasurements, setManualMeasurements] = useState<Record<string, string>>({})

  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 붙여넣은 표의 사이즈 라벨(예: "L")은 무신사 원문 그대로 보존하지만, 사용자가 이 입력칸에
  // 소문자로 적어도("l") 매칭되도록 대소문자 구분 없이 비교한다.
  // 신발·액세서리는 FIT_RULES에 항목이 없어 애초에 핏 채점 대상이 아니므로(lib/fit/rules.ts 주석 참고),
  // 실측 입력 UI 자체를 보여주지 않는다 — 의미 없는 총장·가슴단면 입력칸을 채우게 하지 않기 위해서다.
  const hasMeasurableFit = category in FIT_RULES

  const matchedSizeKey = Object.keys(pastedSizeTable).find(
    (key) => key.toLowerCase() === size.trim().toLowerCase(),
  )
  const parsedForSize = matchedSizeKey ? pastedSizeTable[matchedSizeKey] : undefined
  const hasParsedForSize = Boolean(parsedForSize && Object.keys(parsedForSize).length > 0)

  function manualMeasurementsAsNumbers(): Record<string, number> {
    const entries: Record<string, number> = {}
    for (const key of STANDARD_KEYS) {
      const raw = manualMeasurements[key]
      const value = raw ? Number(raw) : NaN
      if (Number.isFinite(value) && value > 0) entries[key] = value
    }
    return entries
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const hasFullPastedTable = Object.keys(pastedSizeTable).length > 0

    const payload: GarmentSubmitPayload = {
      goodsNo: parsed.goodsNo,
      sourceUrl,
      name: name.trim(),
      brand: brand.trim() || null,
      price: price ? Number(price) : null,
      imageUrl: imageUrl.trim() || null,
      category,
      colorOption: color.trim(),
      sizeOption: size.trim(),
      // 붙여넣은 표에 지금 선택한 사이즈 행이 있으면 그 값을, 없으면(붙여넣지 않았거나 행이 없으면) 수동 입력값을 쓴다.
      measurements: hasParsedForSize && parsedForSize ? parsedForSize : manualMeasurementsAsNumbers(),
      fullSizeTable: hasFullPastedTable ? pastedSizeTable : null,
      manualFields,
    }

    const body: Record<string, unknown> = { ...payload, ...extraBody }
    if (noteField) body.note = note.trim() || null

    const response = await fetch(submitEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSubmitting(false)

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? '처리하지 못했습니다.')
      return
    }
    onSubmitted(await response.json())
  }

  return (
    <form onSubmit={handleSubmit} className={`${CARD_SURFACE} space-y-4 p-5`}>
      {/*
        type="button"이 반드시 필요하다: <form> 안의 <button>은 type을 안 주면 submit이 기본값이라,
        접기를 누르는 순간 폼이 제출돼 버린다.
      */}
      {onCancel && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-ink-muted underline transition hover:text-ink"
          >
            접기
          </button>
        </div>
      )}

      {manualFields.length > 0 && (
        <p className="rounded-btn border border-border bg-canvas p-3 text-sm text-ink-muted">
          일부 정보를 자동으로 가져오지 못했습니다. 아래 표시된 칸만 채워주세요.
        </p>
      )}

      <Field label="상품명" manual={!f.name.ok}>
        <input value={name} onChange={(e) => setName(e.target.value)} readOnly={f.name.ok}
          required className={INPUT} />
      </Field>

      <Field label="브랜드" manual={!f.brand.ok}>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} readOnly={f.brand.ok}
          className={INPUT} />
      </Field>

      <Field label="가격" manual={!f.price.ok}>
        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} readOnly={f.price.ok}
          className={INPUT} />
      </Field>

      <Field label="카테고리" manual={!f.category.ok}>
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)}
          className={INPUT}>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </Field>

      <Field label="색상" manual={!f.options.ok}>
        {colors.length > 0 ? (
          <select value={color} onChange={(e) => setColor(e.target.value)}
            required className={INPUT}>
            {colors.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <input value={color} onChange={(e) => setColor(e.target.value)} required
            placeholder="예: 블랙" className={INPUT} />
        )}
      </Field>

      <Field label="사이즈" manual={!f.options.ok}>
        {sizes.length > 0 ? (
          <select value={size} onChange={(e) => setSize(e.target.value)}
            required className={INPUT}>
            {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <input value={size} onChange={(e) => setSize(e.target.value)} required
            placeholder="예: L" className={INPUT} />
        )}
      </Field>

      {hasMeasurableFit && (
        <Field label="실측" manual>
          <PasteSizeTableField onParsed={setPastedSizeTable} />
          {hasParsedForSize ? (
            <p className="text-sm text-ink">
              {size || '선택한'} 사이즈 값이 자동으로 채워졌습니다: {Object.entries(parsedForSize!).map(([k, v]) => `${k} ${v}cm`).join(', ')}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {[...STANDARD_KEYS].map((key) => (
                <label key={key} className="text-xs text-ink-muted">
                  {key}
                  <input
                    type="number"
                    value={manualMeasurements[key] ?? ''}
                    onChange={(e) =>
                      setManualMeasurements((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className={`${INPUT} px-2 py-1`}
                  />
                </label>
              ))}
            </div>
          )}
        </Field>
      )}

      {!f.imageUrl.ok && (
        <Field label="이미지 주소" manual>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…" className={INPUT} />
        </Field>
      )}

      {noteField && (
        <Field label="코멘트" manual={false}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            placeholder="추천 이유를 남겨보세요 (선택)" className={INPUT} />
        </Field>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full py-3">
        {submitting ? '처리 중…' : submitLabel}
      </Button>
    </form>
  )
}

function Field({ label, manual, children }: { label: string; manual: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-ink">
        {label}
        {manual && <span className="ml-2 text-xs text-accent">직접 입력</span>}
      </span>
      {children}
    </label>
  )
}
