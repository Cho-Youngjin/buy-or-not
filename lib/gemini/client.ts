import { GoogleGenAI } from '@google/genai'

let client: GoogleGenAI | null = null

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  }
  return client
}

// gemini-2.5-flash는 신규 발급 API 키에서 404("no longer available to new users")를
// 반환한다 — 스펙 작성 시점(2026-08-13) 이후 Google이 신규 사용자 대상 접근을 막았다.
// 실제 이 키로 client.models.list()를 호출해 확인한 사용 가능한 flash 계열 중 하나로 바꿨다.
export const GEMINI_MODEL = 'gemini-3.5-flash'
