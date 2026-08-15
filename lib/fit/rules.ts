import type { Category } from '@/lib/types'

export type Severity = 'low' | 'medium' | 'high' | 'fatal'

export type FieldRule = {
  /** 허용 편차(cm). 이 안쪽이면 위반 없음. */
  tolerance: number
  severity: Severity
  weight: number
}

/**
 * 카테고리·항목별 허용 편차·심각도·가중치 (스펙 §9).
 * 허리단면 2cm는 아예 못 입는 문제고 총장 2cm는 무의미하다 — 이 차이를 코드가 알고 있어야
 * "총장은 좀 길지만 괜찮고 허리가 안 맞습니다" 같은 우선순위 있는 피드백이 나온다.
 * 신발·액세서리는 실측 기반 핏 판단 대상이 아니라 의도적으로 비워둔다.
 */
export const FIT_RULES: Partial<Record<Category, Record<string, FieldRule>>> = {
  top: {
    어깨너비: { tolerance: 1.5, severity: 'high', weight: 3 },
    가슴단면: { tolerance: 2.0, severity: 'high', weight: 3 },
    총장: { tolerance: 3.0, severity: 'medium', weight: 2 },
    소매길이: { tolerance: 2.5, severity: 'low', weight: 1 },
  },
  // 아우터는 레이어링을 감안해 상의 허용편차에 +1.0cm를 더한다(스펙 §9).
  outer: {
    어깨너비: { tolerance: 2.5, severity: 'high', weight: 3 },
    가슴단면: { tolerance: 3.0, severity: 'high', weight: 3 },
    총장: { tolerance: 4.0, severity: 'medium', weight: 2 },
    소매길이: { tolerance: 3.5, severity: 'low', weight: 1 },
  },
  bottom: {
    허리단면: { tolerance: 1.5, severity: 'fatal', weight: 5 },
    밑위: { tolerance: 1.5, severity: 'high', weight: 3 },
    허벅지단면: { tolerance: 1.5, severity: 'high', weight: 3 },
    엉덩이단면: { tolerance: 2.0, severity: 'medium', weight: 2 },
    밑단단면: { tolerance: 2.0, severity: 'medium', weight: 2 },
    총장: { tolerance: 3.0, severity: 'medium', weight: 2 },
  },
}

/** 같은 카테고리 owned 옷이 이 수 미만이면 핏 비교를 건너뛴다(스펙 §9 "데이터 부족 처리"). */
export const MIN_OWNED_GARMENTS_FOR_FIT = 3

/** Gemini가 반환한 매칭 심각도(ok/warn/bad)를 fit_score와 합산 가능한 점수로 환산한다. */
export const MATCH_PENALTY: Record<'ok' | 'warn' | 'bad', number> = { ok: 0, warn: 2, bad: 4 }

/** fit_score + match_penalty 합계가 이 값 이하면 caution, 초과면 skip(치명 위반이 없을 때). */
export const VERDICT_CAUTION_MAX = 4
