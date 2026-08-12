# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Pre-implementation.** This repository currently contains only design documents — no application code exists yet. Before writing code, read:

- `docs/superpowers/specs/2026-08-13-buy-or-not-design.md` — full design spec (data model, RLS policies, fit-judgment algorithm, Gemini integration, screens, error handling, risks)
- `docs/superpowers/plans/2026-08-13-plan1-foundation-and-wardrobe.md` — implementation plan for Phase 0–2 (Musinsa parsing feasibility, project scaffold, wardrobe registration). This is the first of three planned implementation docs; plans 2 and 3 (fit judgment/Gemini/cart, sharing/outfits) will be written after plan 1 lands, informed by what Phase 0 discovers about Musinsa's actual page structure.

Treat these two documents as the source of truth for architecture and scope. If code and docs disagree, the docs describe intent — flag the conflict rather than silently picking one.

## 작업 방식 (사용자 지시사항)

- **답변은 한국어로 한다.** 코드 식별자·주석은 프로젝트의 다른 관례를 따르되(예: 실측 항목명은 한국어), 사용자에게 하는 설명·요약·질문은 한국어로 쓴다.
- **기능마다 코드를 보고 학습할 수 있도록 주석을 단다.** 이 리포의 기본 원칙(“default to writing no comments”, WHY만 남기고 WHAT은 안 남김)에 대한 예외다. 이 프로젝트는 학습 목적의 사이드 프로젝트이므로, 각 기능 단위(함수·모듈·API 라우트)마다 그 코드가 무엇을 하는지, 왜 그렇게 구현했는지 설명하는 주석을 남긴다. 특히 이 문서의 "왜 이렇게 짜여지는가" 절에 적힌 결정들(RLS 전담, 결정론/AI 서술 분리, 필드 단위 파싱 실패 등)이 적용되는 지점에는 그 이유를 주석으로 남겨 다음에 코드를 읽을 때(사용자 본인이든 미래의 Claude든) 근거를 바로 알 수 있게 한다.
- **프론트엔드 디자인은 `design-taste-frontend-v1`을 사용한다.** 이 스킬/가이드는 현재 이 머신에 설치되어 있지 않다(스킬 목록에 없고 `~/.claude` 아래에서도 찾지 못함). 프론트엔드 작업을 시작하기 전에 이것이 무엇을 가리키는지(설치할 스킬 이름인지, 참고할 디자인 시스템/문서인지) 사용자에게 먼저 확인한다.
- **함께 개발한다 — 기능을 추가할 때마다 알린다.** 코드는 협업 대상이지 일방적으로 완성해서 던지는 결과물이 아니다. 기능 하나를 추가·변경할 때마다 무엇을 만들었는지 사용자에게 알리고, 사용자가 직접 수정한 부분은 Claude가 검토·평가하고, Claude가 만든 부분은 사용자가 평가하는 상호 리뷰 흐름으로 진행한다. 여러 기능을 한 번에 조용히 구현해서 나중에 몰아서 보고하지 않는다. `superpowers:subagent-driven-development`처럼 태스크를 통째로 서브에이전트에 위임해 진행 상황이 대화 밖에서 처리되는 실행 방식은 이 프로젝트의 협업 방식과 맞지 않으므로 기본으로 쓰지 않는다.

## What this is

A Korean-language web app that helps users decide whether to buy a clothing item before purchasing it online, to reduce returns caused by poor fit or items that don't match their existing wardrobe. Users register owned clothes by pasting a Musinsa (무신사) product link — Musinsa has no public API, so the app scrapes the product page. Registered items form a "wardrobe" with saved measurements and preference ratings. When considering a new purchase, the user pastes that item's link and the app compares it against the wardrobe's measurement profile (deterministic) and style tags (Gemini-assisted) to produce a buy/caution/skip verdict with Korean-language feedback. Wardrobes can be shared via a public link for friends to recommend items or assemble outfits.

Solo side project for a job-hunting portfolio — not built for scale or multi-region traffic.

## Tech stack (per spec §4)

Next.js 15 (App Router, TypeScript) · Tailwind CSS · Supabase (Postgres/Auth/Storage/RLS) · Google Gemini API (`gemini-2.5-flash`) · cheerio (HTML parsing) · Vitest · deployed on Vercel.

Node.js 20+, npm as package manager, TypeScript `strict: true` with no `any`.

## Commands

The project isn't scaffolded yet (see plan 1, Task 2). Once it is, these are the commands defined by the plan:

```bash
npm run dev                              # dev server
npm run build                            # production build (must pass with zero type errors)
npm test                                 # vitest run (all tests)
npm test -- tests/musinsa/parser.test.ts # run a single test file
npx supabase start                       # local Supabase (requires Docker)
npx supabase db reset                    # apply migrations to local DB
npx supabase link --project-ref <ref>    # link to remote project
npx supabase db push                     # apply migrations to remote project
npx supabase db diff --schema public     # verify migrations match live schema
```

## Architecture (why the code will be shaped this way)

**Everything external goes through the server.** The browser never calls Musinsa or Gemini directly — Musinsa blocks CORS from browsers and the Gemini API key must never reach the client. All such calls live in Next.js Route Handlers under `app/api/`. Route Handlers use the session-scoped Supabase client (`lib/supabase/server.ts`), never the `service_role` client, except for the two things that legitimately need to bypass RLS: the Musinsa cache and Storage uploads (`lib/supabase/admin.ts`). Grep for `SUPABASE_SERVICE_ROLE_KEY` usage outside that one file — there shouldn't be any.

**RLS is the entire access-control model**, not a backstop. There is no application-layer permission check duplicating what the database already enforces. When adding a table or a new access pattern, the policy goes in a `supabase/migrations/*.sql` file, and the correct place to verify it is a test that hits real Postgres with two authenticated users (see `tests/rls.test.ts` in plan 1) — not a unit test that mocks the client.

**`garments` is one table for both "owned" and "considering" (cart) items**, distinguished by `status`. Moving an item from cart to wardrobe ("샀어요" / "I bought it") is an `UPDATE status`, not a copy — this avoids duplicating the parse/image/tagging pipeline. Don't split this into separate tables.

**Measurements are normalized, not JSON.** `garment_measurements` is a `(garment_id, key, value)` table because different categories (tops vs. bottoms) have different measurement fields, and the core query the app runs — "average 총장 across items I rate highly" — needs to aggregate across that key, which is awkward in JSONB and trivial in SQL. Standard keys are a fixed set of 9 Korean terms (총장, 어깨너비, 가슴단면, 소매길이, 허리단면, 엉덩이단면, 허벅지단면, 밑위, 밑단단면); `lib/musinsa/measurements.ts` normalizes Musinsa's inconsistent labels (e.g. "가슴 단면", "흉위") to these via an alias table, but **never discards an unrecognized key** — it's stored verbatim so the alias dictionary can be extended later without losing historical data.

**Fit judgment is deterministic code; only prose generation goes to Gemini.** LLMs are unreliable at arithmetic, so deviation calculation, severity weighting, and the final buy/caution/skip verdict are computed in plain TypeScript (`lib/fit/*`, `lib/verdict.ts` — pure functions, unit-testable without network access). Gemini receives the already-computed report and is asked only to phrase it in natural Korean and to judge style/color matching (returned as a constrained 3-level enum, not free text that gets treated as ground truth). Never let Gemini's output override or recompute a numeric judgment. The deviation-tolerance and severity-weight tables live as named constants in one file (`lib/fit/rules.ts`) so they can be tuned without touching logic.

**Vision tagging happens once, at registration** (`lib/ai/tagger.ts`), producing `ai_tags` stored on the `garments` row. Purchase-decision analysis reuses those stored tags for both the candidate item and every wardrobe item — it never re-sends images at judgment time, even when comparing against a 30-item wardrobe.

**The Musinsa parser is an isolated adapter** (`lib/musinsa/parser.ts`) that turns raw HTML into a `ParseResult` as a pure function — no network code inside it, so it's tested entirely against saved HTML fixtures (`tests/fixtures/musinsa/`). Network fetching (timeout, retry) is a separate module (`lib/musinsa/fetcher.ts`). Parsing failure is field-level, not all-or-nothing: `ParseResult.fields.<field>` is `{ ok: true, value } | { ok: false, reason }`, and the registration form locks successfully-parsed fields as read-only while only rendering inputs for the fields that failed. When Musinsa's page structure changes, only `parser.ts` and its fixtures should need updating.

**Phase 0 of plan 1 is a research gate, not a coding task** — it involves manually fetching real Musinsa product pages, checking `robots.txt`, and determining whether data is in static HTML, JSON-LD, or requires hitting an internal API. Its findings (`docs/superpowers/notes/phase0-musinsa-findings.md`, once written) determine how `parser.ts` is actually implemented, and downstream tasks should not be started against assumed HTML structure before that file exists.
