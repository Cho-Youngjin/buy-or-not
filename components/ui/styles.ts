/**
 * 카드 표면 공통 클래스.
 * 컴포넌트가 아니라 클래스 상수인 이유: 카드의 루트가 Link(옷장 카드)·article(룩)·form(등록 폼)으로
 * 제각각이라, <Card> 컴포넌트로 만들면 의미 없는 래퍼 div가 한 겹씩 더 생긴다.
 * 그림자 대신 헤어라인 보더만 쓴다(스펙 §3).
 */
export const CARD_SURFACE = 'rounded-card border border-border bg-surface'

/**
 * 입력칸 공통 클래스. GarmentForm 한 파일에서만 같은 조합이 10번 넘게 반복되고 있었다.
 * read-only:는 파싱에 성공해 잠긴 필드를 시각적으로 구분한다(스펙의 "필드 단위 파싱 실패" 원칙).
 */
export const INPUT =
  'w-full rounded-btn border border-border bg-surface px-3 py-2 text-sm text-ink ' +
  'placeholder:text-ink-muted focus:border-accent focus:outline-none ' +
  'read-only:bg-canvas read-only:text-ink-muted'

export type PillTone = 'neutral' | 'active' | 'buy' | 'caution' | 'skip'

const PILL_TONES: Record<PillTone, string> = {
  neutral: 'border-border bg-surface text-ink-muted',
  active: 'border-accent bg-accent text-accent-ink',
  // buy/caution/skip은 판정을 색으로 구분해야 해서 "액센트 1개" 원칙의 예외다(계획 서두 참고).
  // 하드코딩된 hex 대신 @theme 토큰을 쓴다 — 다크모드에서 이 값들도 같이 바뀌어야 한다(계획 15).
  buy: 'border-transparent bg-buy-bg text-buy-text',
  caution: 'border-transparent bg-caution-bg text-caution-text',
  skip: 'border-transparent bg-skip-bg text-skip-text',
}

/** 필 모양 배지/칩의 클래스를 만든다. 배지는 span, 카테고리 칩은 Link라 컴포넌트로 묶지 않았다. */
export function pillClass(tone: PillTone): string {
  return `inline-block rounded-full border px-3 py-1 text-sm transition ${PILL_TONES[tone]}`
}
