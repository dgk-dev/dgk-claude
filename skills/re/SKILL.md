---
allowed-tools: [Read, Write, Edit, MultiEdit, Bash, Glob, Grep, TaskCreate, TaskUpdate, TaskList, TaskGet, Task, WebSearch, WebFetch, AskUserQuestion, mcp__context7-mcp__resolve-library-id, mcp__context7-mcp__query-docs, mcp__sequential-thinking__sequentialthinking, mcp__jina__*]
description: "Research-first workflow: 리서치 → 분석 → 실행/수정 → 검증 → 커밋 (상황에 맞게 PHASE 자동 조절)"
argument-hint: "feature description (예: 'user authentication' 또는 'dashboard UI component')"
disable-model-invocation: false
---

# /re - Research & Execute

**📌 워크플로우**: 리서치 기반 실행 방법론

**철학**:
- **"리서치 없이 구현 없다"** - 모든 구현 전에 철저한 조사를 강제
- **사용자 방향과 의도 파악 우선** - 요청이 모호하거나 여러 해석이 가능할 때, 어떤 Phase에 있든 추측하지 말고 AskUserQuestion으로 명확히 확인. 최대한 질문을 많이해서 사용자의 방향과 의도를 디테일하게 정확히 일치시킨 후에 진행. 최소 컨텍스트 파악(Phase 1) 후 질문.
- **엔터프라이즈 레벨 품질** - 임시 방편·우회·타협 대신, 대기업이 택할 근본적이고 유지보수 가능한 궁극적 솔루션
- **작업량/시간 무관** - 오래 걸리고 거대한 작업이라도 최종 품질만 고려
- **토큰 절약 금지** - 효율성 핑계로 정확성을 희생하지 않음
- **복수 옵션 제시** - 항상 최소 3가지 접근법 비교 후 최적안 추천
- **타협 금지** - 구현 난이도나 변경 범위를 이유로 차선책 선택 금지, 리스크 과도 시에만 예외

---

**🎨 UI/UX 가이드라인** (권장):

**원칙**: shadcn/ui 컴포넌트 + 테마 변수 최대 활용

1. **shadcn 컴포넌트 우선**
   - 새 UI 구현 전 shadcn/ui에 해당 컴포넌트가 있는지 먼저 확인
   - 없으면 `pnpm dlx shadcn@latest add [component]`로 설치 후 사용
   - shadcn에 없는 경우에만 커스텀 컴포넌트 제작 (테마 변수 활용하여 통일감 유지)

2. **테마 변수 사용 (하드코딩 금지)**
   ```tsx
   // ❌ 피할 것 - Tailwind 기본 색상 직접 사용
   <div className="bg-blue-500 text-white border-gray-300">

   // ✅ 권장 - 테마 변수 클래스 사용
   <div className="bg-primary text-primary-foreground border-border">
   ```

---

**사용법**: `/re [feature-description]`

---

## 🚨 강제 실행 단계

### ✅ PHASE 1: 컨텍스트 파악 (MANDATORY)

**목적**: 프로젝트 컨텍스트 파악 및 리서치 타겟 식별

**리서치 디렉토리 생성** (PHASE 시작 전):
- feature description에서 slug 생성 (소문자, 공백→하이픈, 특수문자 제거, 최대 30자)
- 예: `/re user authentication` → `user-authentication`
```bash
mkdir -p /tmp/re-research/{feature-slug}/
```

**탐색 방법**: Claude Code 내장 도구 자유 활용
- Glob으로 프로젝트 구조 파악 (예: `**/*.ts`, `src/**/*.tsx`)
- Grep으로 핵심 패턴 검색 (예: `export.*function`, `import.*from`)
- Read로 주요 설정 파일 확인 (package.json, tsconfig.json 등)
- 필요시 Explore subagent로 병렬 탐색 (대규모 코드베이스)

**Git History 확인** (git repo인 경우):

**1단계: 직접 관련 커밋 검색**
```bash
# 현재 작업 키워드로 검색 (예: auth, payment, dashboard)
git log --oneline -50 --grep="키워드" --format="%h %s"
```

**2단계: 프로젝트 공통 교훈 확인**
```bash
# 키워드 무관하게 최근 학습 태그 훑어보기
git log --oneline -30 --grep="\[gotcha\]\|\[insight\]\|\[context\]" --format="%s"
```

**3단계: 필요한 커밋만 상세 확인**
```bash
git show <commit-hash> --format="%B" --no-patch
```

- 1단계: 현재 작업과 **직접** 관련된 커밋
- 2단계: **프로젝트 전반 교훈** (다른 작업에서 배운 것도 적용 가능)
- 자율적으로 현재 작업에 적용 가능한 학습 판단
- 관련 없는 커밋은 무시

**필수 산출물**:
- 📦 기술 스택 및 라이브러리 버전
- 🏗️ 프로젝트 패턴 (App Router, 상태관리, API 통신, 스타일링 등)
- 🏷️ 네이밍 컨벤션 및 디렉토리 구조
- 🎯 리서치 타겟 (Context7 라이브러리, 웹 검색 키워드)
- 📜 이전 세션 학습 내용 (Git History에서 추출한 insight/gotcha/decision)

**완료 표시**: TaskUpdate로 "PHASE 1 완료" 마크

---

### ✅ PHASE 2: 리서치 (MANDATORY)

**목적**: 공식 문서 권장 패턴(최우선) → 검증된 업계 모범사례 → 커뮤니티 사례 확보

**🚀 병렬 실행 전략** (Scatter-Gather 패턴):

⚠️ **순차 실행 금지** - 독립적인 검색은 반드시 병렬로 실행

**기본: Task subagent 3~7개 병렬화** (작업 복잡도에 따라 조절)

주제 분석 후 subagent에 조사 영역 분배:
- **3~7개** subagent 동시 실행 (단순 3개, 중간 4~5개, 복잡 6~7개)
- 각 subagent가 충분한 소스를 확보
- 주제 특성에 맞게 조사 영역 세분화
- 모델: `model: "haiku"` 고정

```
# 예시: "Next.js 인증 구현" 주제 → 4개 subagent 분배 (model: "haiku")
Task("Next.js App Router 공식 인증 패턴 + OAuth 2.0 프로토콜", model: "haiku")
Task("세션 vs JWT 토큰 전략 비교", model: "haiku")
Task("NextAuth.js vs Lucia 비교 분석", model: "haiku")
Task("인증 보안 취약점 및 대응 (OWASP)", model: "haiku")
```

→ 각 subagent: Context7 + WebSearch + Jina MCP 사용 (WebFetch 금지)
→ 각 subagent: 핵심 결론과 구체적 식별자를 포함하여 반환. 상세(원문 인용/URL/코드)는 /tmp/re-research/{feature-slug}/ 파일에 작성
→ subagent 프롬프트에 "상세는 /tmp/re-research/{feature-slug}/[주제명].md에 작성." 지시
→ TaskOutput으로 결과 수집 후 통합

**보조: 도구 직접 호출** (간단한 확인 작업 시)
```
WebSearch("특정 키워드") + Context7("라이브러리", topic="주제")
```
→ 1-2개 빠른 확인 시에만 사용

**필수 워크플로우** (Context7):
1. `resolve-library-id`로 관련 라이브러리 **여러 개 동시** 식별
2. `query-docs`로 공식 문서 **병렬** 조회
- 자율 선택: 조회할 라이브러리 선택, topic 파라미터

**필수 조건**:
- **Context7 워크플로우**: 필수 실행
- **subagent 수**: 3~7개 (단순 3개, 중간 4~5개, 복잡 6~7개)
- **소스 수**: 각 subagent가 충분한 소스를 확보
- **병렬 실행**: 모든 subagent 동시 실행 (순차 금지)
- **모델**: `model: "haiku"` 고정

**리서치 전략**:
- Context7 + WebSearch + Jina MCP로 공식 문서 → 검증된 업계 모범사례 → 커뮤니티 사례 동시 수집
- 교차 검증: 핵심 결정 사항은 2+ 독립 소스로 확인
- 신뢰 가능 소스 우선 (공식 블로그, 프레임워크 문서, 개발자 커뮤니티 등)

**리서치 도구 (교차 검증용, 공식 문서 신뢰도 최우선)**:
- **Context7 MCP** (`resolve-library-id` → `query-docs`) — 공식 문서 조회, 데이터 신뢰도 최우선
- **WebSearch** — 최신 업계 동향 및 모범사례 검색 (예: "Next.js 15 auth patterns 2026")
- **Jina MCP** — 웹페이지 본문 추출 (깔끔한 마크다운, Cloudflare 우회)
- **WebFetch** — ⚠️ **사용 금지** (병목 원인: 타임아웃 미구현, hang 시 인터럽트 불가)

**웹 접근 규칙**:
- ⚠️ **WebFetch 사용 금지** — subagent/메인 모두. Jina MCP로 대체
- subagent(haiku)에서 Jina MCP 사용 가능 (WebFetch와 달리 타임아웃 지원)
- GitHub 이슈/PR은 **gh CLI 우선** 사용
- 자율성: Context7 topic, WebSearch 쿼리, Jina MCP 활용 전략은 자율 판단

**결과 집계 전략**:
- 여러 소스에서 동일 정보 = 신뢰도 상승 (교차 검증 원칙)
- 출처별 우선순위: 공식 문서 > 검증된 업계 모범사례 > 커뮤니티
- 상충 정보는 최신 날짜 우선

**필수 산출물**:
- 📚 **공식 권장 패턴**: 공식 문서 기반 베스트 프랙티스
- 🌐 **검증된 업계 모범사례**: 커뮤니티 검증된 최신 모범사례 (현재 연도 기준)
- ❌ **안티패턴**: 회피해야 할 접근법 및 주의사항
- 🎯 **사용자 명령 수행 정보**: 현재 작업에 필요한 모든 관련 정보

**완료 표시**: TaskUpdate로 "PHASE 2 완료" 마크

---

### ✅ PHASE 3: 코드베이스 전체 분석 (MANDATORY)

**목적**: 구현 전 관련 코드를 **전부** 파악하여 일관성 있는 구현 보장

**⚠️ 핵심 원칙: 정확성 최우선**

코드를 일부분만 대충 훑어보는 것은 **절대 금지**. 관련 코드는 반드시 **전체를 읽어야** 한다. 일부만 보고 추측하면 기존 패턴과 충돌하거나 중복 구현이 발생한다.

**분석 방법**:
1. **관련 파일 전수 조사**: Glob으로 관련 파일을 **모두** 찾아낸다
2. **전체 코드 읽기**: 찾은 파일은 **전부 Read**로 완독한다 (일부만 읽기 금지)
3. **패턴 추출**: 읽은 코드에서 기존 패턴을 정확히 파악한다

**구체적 실행**:
- 새 기능과 관련된 기존 컴포넌트/함수/타입 **전체** 읽기
- 비슷한 기능이 이미 있는지 **전체 코드베이스** 확인
- import/export 관계, 의존성 **완전히** 파악
- 필요시 Explore subagent로 병렬 탐색 (대규모 코드베이스)

**왜 전체를 읽어야 하는가**:
- 일부만 보면 기존 유틸/헬퍼 함수를 못 찾고 중복 구현함
- 네이밍 컨벤션, 에러 처리 패턴 등을 놓침
- 기존 코드와 스타일이 불일치하는 코드를 작성함

**필수 산출물**:
- 📂 프로젝트 구조 맵
- 🏗️ 기존 아키텍처 패턴 (실제 코드 기반, 추측 아님)
- 🔗 통합 지점 (새 기능 삽입 위치)
- 📝 읽은 파일 목록 (전체 코드 파악 증빙)
- ✔️ PHASE 2 검증 결과 (리서치 패턴 vs 프로젝트 구현)

**완료 표시**: TaskUpdate로 "PHASE 3 완료" 마크

---

### ✅ PHASE 4: 구현 계획 및 최적 솔루션 선정

1. **PHASE 1, 2, 3 완료 확인** (미완료 시 구현 불가)

2. **Sequential Thinking MCP로 종합 분석**:
   - Context7 공식 가이드라인
   - 웹 최신모범사례 vs 안티패턴
   - 프로젝트 패턴 vs 통합 지점
   - 리스크 및 대안 평가

   **🔍 자기검증 3질문** (Sequential Thinking 완료 전 반드시 포함):
   - "이 분석에서 **가장 어려운 결정**은 무엇이었나?"
   - "어떤 **대안을 거부**했고, **왜** 그랬나?"
   - "**가장 확신이 없는 부분**은?"
   → 목적: 옵션이 답정너가 되지 않고 진정으로 competitive하게 + 판단의 신중성 확보

3. **코딩 핵심 체크**:
   - **중복 제거 (SSOT)**: 같은 로직/상수 중복 여부
   - **보안 검증**: 민감 정보 노출, 입력 검증 누락
   - **컨텍스트 일관성**: 프로젝트 패턴 준수

4. **최소 3가지 구현 옵션 도출** (필수):
   - ⚠️ 모든 옵션은 엔터프라이즈 레벨 품질 기준 충족 필수 (임시 방편/우회 방법 제외)
   - 각 옵션마다 반드시 포함:
     - **개요**: 접근 방식 한 줄 요약
     - **변경 영역**: 수정할 컴포넌트/모듈/레이어 명시 (파일명 아닌 영역 수준)
     - **기술적 Trade-off**: 성능 vs 복잡도, 유연성 vs 학습비용 등
     - **리스크/주의사항**: 선택 시 주의할 점
     - **유지보수/확장성**: 장기적 관점에서의 영향
     - **사용자 영향**: 최종 결과물/UX 차이
     - **향후 변경 시**: 기능 추가/수정 시 영향
     - **권장 상황**: 어떤 경우에 이 옵션이 적합한지

5. **최적 솔루션 추천 + 객관적 비교**:
   - 평가 기준 명시: SSOT, 확장성, 유지보수성, 공식 권장사항, 업계 표준 등
   - 각 옵션을 기준별로 비교한 후 최적안 도출 (주관적 추천 아닌 객관적 비교)
   - ⚠️ **중요**: 작업량은 평가 대상 아님 (최종 품질만 고려)
   - ⚠️ **선정 원칙**: 리스크가 과도하지 않은 한, 항상 가장 근본적이고 완전한 솔루션 선택 (중간 타협안/절충안 지양)

6. **구현 계획 상세화** (필수):
   - 단순 체크리스트가 아닌 **변경 영역별 상세 설명**
   - 각 단계마다: 무엇을, 왜, 어떤 순서로 변경하는지 명시
   - 필요 시 10개 이상 항목도 OK (상세함 우선)

7. TaskUpdate로 "옵션 A/B/C 도출, 최적 솔루션: [X]" 마크

⏸️ **승인 대기** (PHASE 5 진행 전 필수)
- 옵션 비교표 + 최적 솔루션 제시
- 선택지: **"1) 추천안 진행 / 2) 다른 옵션 선택 / 3) 수정 요청 / 4) 추가 탐색"**

✅ **승인 후 실행 흐름**:
- 사용자 승인 시 → PHASE 5 (구현 및 검증) 진행
- PHASE 5 완료 후 사용자에게 다음 단계 선택 요청

**필수 산출물**: 옵션 비교, 최적안 추천, 구체적 근거, 단계별 계획, 리스크 대응

---

### ✅ PHASE 5: 구현 및 검증

1. 승인된 계획에 따라 단계별 구현
2. 각 단계마다 TaskUpdate 업데이트
3. PHASE 2, 3, 4 결과 준수 확인:
   - 공식 가이드라인 적용
   - 검증된 업계 모범사례 반영
   - 프로젝트 패턴 일관성
   - 핵심 체크 통과

4. 구현 완료 후 자동 품질 검증:

   #### 🔍 1차: 기계적 검증 (verify→fix 루프)

   **TypeCheck + Lint 병렬 실행** (단일 응답에서 2개 Bash 동시 호출)
   - 실패 시 → 자동 수정 → 재검증 (최대 3회 루프)
   - 이번 세션에서 수정한 파일의 오류만 수정

   #### 🔍 2차: 의미적 리뷰

   - 이번 세션에서 수정한 파일 전체를 Read로 완독
   - 논리적 오류, 일관성, 엣지케이스, 보안 취약점 점검
   - 발견 시 자동 수정 → 1차(기계적 검증) 재실행
   - 모든 검증 통과 → 사용자 선택 대기

---

⏸️ **PHASE 5 완료 후 사용자 선택** (AskUserQuestion)

검증 통과 후 사용자에게 다음 단계 선택 요청:
- **1) Cleanup → Commit → /rrr** (GLM-5 코드 리뷰)
- **2) Cleanup → Commit → Push**
- **3) Cleanup → Commit만** (Push 없음)
- **4) 추가 작업 (직접 입력)**

---

### 🚀 PHASE 6: Commit & Push

**실행 조건**: 사용자가 옵션 1, 2, 또는 3 선택 시

#### 🧹 STEP 1: Code Cleanup

**목적**: Commit 전 최종 정리 - 이번 세션에서 발생한 모든 정리 필요 사항을 자율 판단하여 처리

**정리 대상** (자율 판단):
- 미사용 import/변수/함수 제거
- 임시 주석 및 디버그 코드 제거
- 불필요한 console.log 제거
- 세션 중 남겨둔 TODO 처리
- `pnpm lint --fix` 실행

---

#### 🚢 STEP 2: Commit & Push

**조건**: Git 환경 확인 후 실행 (`.git` 없으면 스킵)

**커밋 형식**: Conventional Commits + 학습 태그
```
feat(auth): Add Google OAuth with refresh token rotation

- OAuth 2.0 authorization code grant 구현
- Access/Refresh token 자동 갱신 로직

[context] auth 모듈은 next-auth 없이 직접 구현 (경량화 목적)
[insight] OAuth state 파라미터는 CSRF 방지 필수
[gotcha] Google은 prompt=consent 있어야만 refresh_token 반환
[decision] JWT 대신 httpOnly 쿠키 선택 - XSS 공격 표면 최소화
[followup] silent refresh 미구현 - 토큰 만료 시 UX 영향

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

**학습 태그 가이드**:
| 태그 | 용도 |
|------|------|
| `[context]` | 향후 세션에 필요한 배경/맥락 |
| `[insight]` | 새로 배운 사실, 패턴, 베스트 프랙티스 |
| `[gotcha]` | 함정, 삽질 원인, 문서에 없는 주의사항 |
| `[decision]` | 설계/아키텍처 결정과 그 이유 |
| `[followup]` | 미완성 작업, 기술 부채, 후속 필요 사항 |

⚠️ **필수 아님** - 의미 있는 학습이 있을 때만 기록 (모든 커밋에 강제 X)

**워크플로우**:
- 옵션 1: `git commit` → `/rrr` (GLM-5 코드 리뷰 스킬 호출)
- 옵션 2: `git commit` → `git push origin main`
- 옵션 3: `git commit`만

---

## 🎉 완료 시 출력

커밋 정보, 주요 변경사항, 검증 결과

---

## 🛡️ 체크포인트

- PHASE 1, 2, 3: **MANDATORY** (미완료 시 구현 불가)
- PHASE 4: 사용자 승인 필수 → 승인 후 PHASE 5 실행
- PHASE 5 완료: 사용자 선택 필수 (Commit+/rrr / Commit+Push / Commit만 / 추가작업 직접 입력)
- 각 PHASE 완료 시 TaskUpdate 필수

---

## ⚠️ 멀티 세션 작업 규칙

**상황**: 여러 Claude 세션이 동시에 같은 프로젝트 작업 시

### 핵심 원칙: 내 작업 범위만 책임진다

1. **TypeCheck/Lint 오류**: 이번 세션에서 수정한 파일이 아니면 **절대 고치지 않음** (다른 세션 작업 중일 수 있음)
2. **Git 커밋**: 이번 세션에서 직접 수정한 파일만 커밋 (`git add .` 금지)
3. **Working Tree 보호**: `git diff`에 내가 수정하지 않은 파일이 보여도 **다른 세션 작업**일 수 있음. `git restore`/`git checkout --`는 bash-guard hook이 차단. 에이전트의 실수가 의심되면 사용자에게 확인 후 조치.

```bash
# ✅ 개별 파일 명시
git add src/components/Button.tsx src/hooks/useAuth.ts

# ❌ 금지 (bash-guard hook이 차단)
git restore -- <파일>
git checkout -- <파일>

# ❌ 금지
git add .
git add -A
```

---

**버전**: 13.5.0

**출처**: https://github.com/dgk-dev/dgk-claude
