---
allowed-tools: [Read, Write, Edit, MultiEdit, Bash, Glob, Grep, Task, WebSearch, WebFetch, AskUserQuestion, TeamCreate, TeamDelete, TaskCreate, TaskUpdate, TaskList, TaskGet, SendMessage, mcp__context7-mcp__resolve-library-id, mcp__context7-mcp__query-docs, mcp__sequential-thinking__sequentialthinking, mcp__jina__*]
description: "Team-based Research & Execute: Opus[1M] Leader + 5 Sonnet teammates 리서치/분석/실행"
argument-hint: "feature description (예: 'user authentication' 또는 'dashboard UI component')"
disable-model-invocation: false
---

# /ret - Team-based Research & Execute

**워크플로우**: 6인 팀 기반 리서치 → 분석 → 실행

**사용법**: `/ret [feature-description]`

---

## 철학

- **"리서치 없이 구현 없다"** - 모든 구현 전에 철저한 조사를 강제
- **사용자 방향과 의도 파악 우선** - 어떤 Phase에 있든, 요청이 모호하거나 여러 해석이 가능할 때 절대 스스로 판단하지 말고 AskUserQuestion으로 명확히 확인. 최대한 질문을 많이 해서 사용자의 방향과 의도를 디테일하게 정확히 일치시킨 후에 진행. 확신이 없으면 무조건 물어본다.
- **정직한 전략가** - 사용자의 명령에만 제한되지 말고, 더 좋은 방안이 있으면 정직하고 솔직한 전략가/설계자로서 충언한다. 문제가 보이면 즉시 지적한다.
- **엔터프라이즈 레벨 품질** - 임시 방편·우회·타협 대신, 근본적이고 유지보수 가능한 궁극적 솔루션
- **작업량/시간 무관** - 오래 걸리고 거대한 작업이라도 최종 품질만 고려
- **토큰 절약 금지** - 효율성 핑계로 정확성을 희생하지 않음
- **복수 옵션 제시** - 항상 최소 3가지 접근법 비교 후 최적안 추천
- **타협 금지** - 구현 난이도나 변경 범위를 이유로 차선책 선택 금지, 리스크 과도 시에만 예외

---

## 팀 모드 강제

> **이 워크플로우는 반드시 TeamCreate로 팀을 생성하여 진행한다.**
> Task 도구 단독 호출로 subagent만 사용하는 것은 금지.
> 리더: Opus[1M] / 팀원 5명: Sonnet (Task tool 제약으로 팀원은 200K context).

---

## 핵심 안전장치

### 팀원 권한 범위 (PHASE별)
- **PHASE 1 (리서치)**: 프로젝트 파일 수정 금지. 리서치 결과는 `/tmp/ret-research/`에만 작성.
- **PHASE 3 (구현)**: Leader가 명시적으로 위임한 범위 내에서만 프로젝트 파일 수정 가능. 자율 판단으로 구현 범위를 확대하지 않는다.
- **git 명령은 Leader 전용**: 팀원의 git add/commit/push를 금지한다.

### 파일 충돌 방지
같은 파일을 두 에이전트가 동시에 수정하면 안 된다.
- 팀원에게 구현 위임 시 **담당 영역(모듈/기능)을 TaskCreate description에 명시**
- 팀원은 담당 영역 내에서 필요한 파일을 자율적으로 수정 가능
- 다만 다른 팀원의 영역과 겹치는 파일은 사전 조율 필요

### 팀원 idle ≠ 작업 완료
팀원이 subagent를 spawn하면 결과 대기 중 idle 알림이 올 수 있다.
- **팀원 idle 알림이 와도 해당 팀원의 task가 `in_progress`이면 절대 개입하지 않는다**
- 팀원이 SendMessage로 최종 결과를 보고할 때까지 기다린다
- 같은 작업을 다른 팀원에게 재배정하거나 Leader가 직접 수행하는 것을 금지한다
- 팀원이 오래 걸린다고 판단되면, 해당 팀원에게 진행 상황을 물어본다 (재배정 아님)
- **task 완료 후**: 팀원이 보고를 완료하면, 다음 태스크 배정 전 교체 여부를 판단한다 (→ "팀원 교체 정책" 참조)

### 팀원 교체 정책 (Per-task Replacement)
팀원이 태스크를 완료·보고한 후, 다음 태스크 배정 시 교체 여부를 판단한다.

| 조건 | 행동 | 이유 |
|------|------|------|
| 다음 태스크가 이전 작업과 **무관** | 해당 팀원 shutdown + pane kill → 새 팀원 spawn | 팀원 200K 컨텍스트가 차있어 auto-compact 시간 낭비 방지 |
| 다음 태스크가 이전 작업의 **연장선** | 같은 팀원 유지 | 기존 컨텍스트가 직접 활용됨 |

- **판단 주체**: Leader
- **팀(TeamCreate)은 유지**, 팀원만 교체
- **⚠️ 같은 이름 재사용 불가** — 교체 spawn 시 새 이름 부여 필수
- **⚠️ 교체 시 반드시 기존 팀원의 tmux pane kill** (→ "tmux Pane Cleanup" 참조)
- 교체 spawn 시 이전 작업의 관련 결과를 spawn prompt에 구조화하여 주입 (→ "교체 spawn 보충 컨텍스트" 참조)

### tmux Pane Cleanup (팀원 종료 시 필수)
Claude Code의 graceful shutdown (`shutdown_request` → approved)은 Claude 프로세스만 종료하고 **tmux pane은 남겨둔다** (알려진 버그 [#24385](https://github.com/anthropics/claude-code/issues/24385)). 원인: Claude Code가 `send-keys`로 shell 안에서 claude를 실행하므로, claude 종료 후 부모 shell이 살아있어 pane이 유지됨. 따라서 **반드시 pane을 수동으로 kill**해야 한다.

**팀원 종료 절차** (PHASE 3 완료 시 + 팀원 교체 시):
1. 팀 config 파일 Read → 각 팀원의 `tmuxPaneId` 확보 (shutdown 후 config에서 제거되므로 **사전 확보 필수**)
2. `SendMessage shutdown_request` 전송 및 응답 대기
3. 각 팀원의 tmux pane kill:
   ```bash
   tmux kill-pane -t <paneId>  # 팀원별 실행, 실패해도 무시 (2>/dev/null)
   ```
4. 모든 pane 정리 완료 후 `TeamDelete` 진행

**참고**: `TeamDelete`는 `~/.claude/teams/`과 `~/.claude/tasks/` 파일만 정리하며, tmux pane 정리는 범위 밖이다.

### 팀원 subagent 활용
팀원은 Task로 subagent를 활용할 수 있다.
- **Agent 도구로 subagent spawn 시 team_name 파라미터를 절대 포함하지 않는다** (team_name 포함 시 subagent가 아닌 새 팀원이 tmux pane으로 spawn됨)
- 허용: 리서치 (WebSearch, Context7, Jina MCP), 파일 읽기, 코드베이스 탐색
- **⚠️ subagent에서 WebFetch 사용 금지** — Jina MCP로 대체 (타임아웃 지원, Cloudflare 우회)
- subagent 프롬프트에 "WebFetch 사용 금지. Context7 + WebSearch + Jina MCP 사용" 명시
- 금지: subagent에게 코드 구현/파일 수정 위임

### 리서치 파일 격리
리서치 산출물은 프로젝트 디렉토리를 오염시키면 안 된다.
- **모든 리서치 파일은 `/tmp/ret-research/{team_name}/`에만 작성** (프로젝트 디렉토리에 .md 파일 생성 금지)
- 프로젝트 디렉토리에 허용되는 쓰기: 구현 코드, 설정 파일, 사용자가 명시적으로 요청한 문서만
- `/tmp/ret-research/`는 PHASE 4에서 일괄 정리 (decisions.md만 보존)

---

## 리더 운영 규율

### 결정 사항 외부화
- 중요 결정/결과가 나올 때마다 즉시 /tmp/ret-research/{team_name}/decisions.md에 기록
- 목적: 구조화된 결정 기록 + 팀원/PHASE 간 공유 + compact 시 맥락 복구
- compact hook이 팀 이름/PHASE/decisions.md 경로를 재주입

### 전략적 리더 규율
병렬 처리를 통한 속도 극대화와 전략적 판단에 집중이 팀원 위임의 핵심 목적이다. 기본 원칙: **위임 가능하면 위임. 리더가 직접 해야 판단이 가능한 경우에만 직접 수행.**

**허용**:
- 오케스트레이션: TaskCreate, TaskUpdate, SendMessage (태스크 배분·위임·조율)
- 팀원 보고 수신 및 즉시 분석 (도착 즉시 분석 가능, 모든 보고 완료 대기 불필요)
- 사용자 소통: AskUserQuestion으로 방향 확인·승인 요청
- 결정 외부화: decisions.md 작성/갱신
- Sequential Thinking MCP 사용 (종합 분석·판단)
- 판단에 필요한 파일 Read (팀원 보고서, 설정 파일 등 — 위임 가능하면 위임 우선)

**금지**:
- 팀원에게 위임 가능한 작업의 직접 수행 (구현, 리서치, 코드베이스 탐색 등)

**예외**: PHASE 0 부트스트랩(팀 생성 전)과 PHASE 4 검증(팀 해산 후)은 리더 직접 수행

---

## 팀원 간 통신 규칙

### 기본: Hub-and-Spoke (리더 경유)
- 작업 완료 보고, 의사결정 요청, 진행 상황 → 리더에게 보고
- **Leader 메시지 기본 정책**: targeted(개별) 전송. broadcast는 팀 전체에 영향을 미치는 긴급 사항에만 사용.

### 허용: Peer-to-Peer (팀원 간 직접)
- 같은 모듈/영역 작업 시 기술적 세부사항 조율
- 파일 충돌 방지 조율
- 직접 통신 후에는 리더에게 **결과 요약만** 보고 (과정 보고 불필요)

### 금지
- 팀원 간에 의사결정을 자체 해결하는 것 (리더 경유 필수)

---

## PHASE 0: 부트스트랩 (강제)

### 0-1. 컨텍스트 스냅샷

- package.json · tsconfig · 디렉토리 구조 확인
- Git History 확인 (git repo인 경우):

```bash
# 1단계: 직접 관련 커밋 검색
git log --oneline -50 --grep="키워드" --format="%h %s"

# 2단계: 프로젝트 공통 교훈 확인
git log --oneline -30 --grep="\[gotcha\]\|\[insight\]\|\[context\]" --format="%s"

# 3단계: 필요한 커밋만 상세 확인
git show <commit-hash> --format="%B" --no-patch
```

- **기술스택 수집** (팀원 spawn prompt에 주입용):
  - package.json/Cargo.toml 등에서 프레임워크·언어·주요 라이브러리 추출
  - 프로젝트 CLAUDE.md, docs/DECISIONS.md 등에서 확정된 기술 결정 확인
  - 수집 결과를 `/tmp/ret-research/{team_name}/tech-stack.md`에 기록
  - 이 정보는 spawn prompt의 `## 프로젝트 기술스택` 섹션에 삽입됨

### 0-2. 팀 생성 & 팀원 Spawn

```
TeamCreate({
  team_name: "ret-<디테일한 작업명>",
  description: "<디테일한 팀 목적>"
})
```

TeamCreate 완료 후 리서치 디렉토리 생성:
```bash
mkdir -p /tmp/ret-research/${team_name}/
```

팀원 5명을 **한 번의 응답에서 병렬로** spawn:

| 파라미터 | 값 |
|----------|-----|
| `team_name` | TeamCreate에서 사용한 이름 |
| `name` | 작업 특성에 맞게 자율 결정 |
| `model` | `"sonnet"` |
| `subagent_type` | `"general-purpose"` |
| `mode` | `"bypassPermissions"` |

### 0-3. 태스크 배분

TaskCreate × N → TaskUpdate(owner) × N
- 역할 하드코딩 금지 — 작업 특성에 맞게 자율 배분
- 전체 팀원에게 프로젝트 컨텍스트 공유 (SendMessage broadcast)

---

## PHASE 1: 병렬 리서치 & 분석 (강제)

**목적**: 팀원 5명이 병렬로 리서치/분석 수행

**팀원 각자 실행**:
- Task subagent **3~7개를 한 번의 응답에서 동시에** spawn (model: "haiku") → Context7 + WebSearch + Jina MCP + 코드베이스 탐색
- 조사 영역의 복잡도·범위에 따라 subagent 수를 자율 조절:
  - 단순 (1~2개 기술, 명확한 문서): 3개
  - 중간 (복합 기술, 비교 분석): 4~5개
  - 복잡 (광범위 리서치, 다중 통합): 6~7개
- 각 subagent가 충분한 소스를 확보
- 코드베이스 분석: 담당 영역 **전체** 코드 완독 (일부만 훑어보기 절대 금지)

**리서치 도구 (교차 검증용, 공식 문서 신뢰도 최우선)** (subagent에게 전달):
- **Context7 MCP** (`resolve-library-id` → `query-docs`) — 공식 문서 조회, 데이터 신뢰도 최우선
- **WebSearch** — 최신 업계 동향 및 모범사례 검색
- **Jina MCP** — 웹페이지 본문 추출 (깔끔한 마크다운, Cloudflare 우회)
- **WebFetch** — ⚠️ **사용 금지** (병목 원인: 타임아웃 미구현, hang 시 인터럽트 불가)

**웹 접근 규칙**:
- WebFetch 사용 금지 (subagent/팀원 모두). Jina MCP로 대체
- GitHub 이슈/PR 상세 내용 필요 시 **gh CLI 우선** 고려

**팀원 산출물** (→ Leader 보고):
- 공식 문서 권장 패턴(최우선) + 검증된 업계 모범사례 + 커뮤니티 사례 (현재 연도 기준)
- 교차 검증: 핵심 결정 사항은 2+ 독립 소스로 확인
- 안티패턴 및 주의사항
- 담당 영역 코드 구조 + 기존 패턴
- 통합 지점 (새 코드 삽입 위치)

**완료 조건**: 모든 팀원 보고 완료 + Leader 종합 완료 (개별 보고는 도착 즉시 분석 가능)

---

## PHASE 2: 계획 수립 & 사용자 승인 (강제)

### 팀원 보고 종합
- 팀원 보고는 도착 즉시 분석 시작 (모든 보고 완료 대기 불필요)
- 상세가 필요하면 팀원이 작성한 /tmp/ret-research/ 파일을 Read로 참조
- 핵심 결정사항은 /tmp/ret-research/{team_name}/decisions.md에 외부화

1. **Sequential Thinking MCP로 종합 분석**:
   - 팀원 리서치 결과 통합
   - Context7 공식 가이드라인 vs 검증된 업계 모범사례 vs 안티패턴
   - 프로젝트 패턴 vs 통합 지점
   - 리스크 및 대안 평가
   - **자기검증 3질문** (Sequential Thinking 호출 시 반드시 포함):
     1. "이 분석에서 가장 어려운 결정은 무엇이었나?"
     2. "어떤 대안을 거부했고, 왜 그랬나?"
     3. "가장 확신이 없는 부분은?"
   - 목적: 옵션 제시가 답정너가 되지 않고 진정으로 competitive하게 만들기 + 판단의 신중성 확보

2. **코딩 핵심 체크**:
   - **중복 제거 (SSOT)**: 같은 로직/상수 중복 여부
   - **보안 검증**: 민감 정보 노출, 입력 검증 누락
   - **컨텍스트 일관성**: 프로젝트 패턴 준수

3. **최소 3가지 구현 옵션** 도출 (모든 옵션 엔터프라이즈 레벨 필수):
   - 각 옵션: 개요 · 변경 영역 · Trade-off · 리스크 · 유지보수성 · 사용자 영향 · 향후 변경 시 · 권장 상황

4. 객관적 비교 → 최적안 추천 (작업량은 평가 기준 아님, 최종 품질만 고려)
   - 리스크가 과도하지 않은 한, 항상 가장 근본적이고 완전한 솔루션 선택

5. **구현 계획 상세화**: 변경 영역별 상세 설명
   - 각 단계: 무엇을, 왜, 어떤 순서로 변경하는지 명시
   - 필요 시 10개 이상 항목도 OK

**사용자 승인 대기** (AskUserQuestion):
- 옵션 비교표 + 최적 솔루션 + 구현 계획 제시
- 선택지: **1) 추천안 진행 / 2) 다른 옵션 선택 / 3) 수정 요청 / 4) 추가 탐색**

---

## PHASE 3: 자율 실행 (유연)

**전제**: 사용자 승인 완료

이 Phase에서 Leader는 승인된 계획을 바탕으로 **orchestrator로서** 팀원에게 **최대한 위임**한다. Leader는 "전략적 리더 규율"을 준수하며 조율에 집중한다:

- 구현을 팀원에게 분배할 수 있다
- 추가 리서치가 필요하면 팀원에게 다시 리서치를 시킬 수 있다
- 구현 중 문제 발견 시 방향을 전환할 수 있다
- 리서치 → 구현 → 리서치 → 구현 순환이 가능하다
- 팀원 간 교차 리뷰를 시킬 수 있다

**항상 적용되는 원칙**:
- **Working Tree 보호**: `git diff`에 계획 외 파일이 보여도 다른 세션 작업일 수 있음. `git restore`/`git checkout --`는 bash-guard hook이 차단함. 에이전트의 실수가 의심되면 사용자에게 확인 후 조치
- 같은 파일을 두 에이전트가 동시에 수정하면 안 된다
- PHASE 1, 2 결과 준수: 공식 가이드라인, 검증된 업계 모범사례, 프로젝트 패턴
- ⚠️ 팀원에게 SendMessage로 작업 위임 시 "작업 위임 메시지 규칙" 준수 (WebFetch 금지 + Jina MCP 사용 리마인더 필수)
- ⚠️ **팀원 응답 대기**: 팀원에게 보고 요청 후 즉시 응답이 없어도 **충분히 기다린다**. 팀원이 compact(컨텍스트 압축) 중일 수 있으며 수십 초~수 분 소요된다. 응답이 늦다고 팀원의 작업을 Leader가 직접 수행하면 나중에 팀원이 compact를 마치고 같은 작업을 중복 수행하게 된다
- ⚠️ **리더 직접 작업 자제**: Leader는 "전략적 리더 규율"을 따른다 — 위임 가능한 작업의 직접 수행 금지
- ⚠️ **팀원 교체**: 태스크 완료 후 다음 배정 시 "팀원 교체 정책" 적용

### Plan Approval (선택적)
- 복잡하거나 위험도가 높은 구현 태스크 위임 시, 팀원에게 plan mode 요구 가능
- 팀원이 plan 모드에서 구현 계획 수립 → 리더에게 SendMessage로 plan 제출 → 리더 승인 후 구현 시작
- plan_approval_response로 승인/거절 + 피드백
- 모든 태스크에 강제 아님 — 리더가 판단하여 고위험 태스크에만 선택 적용

**PHASE 3 완료 후**: "tmux Pane Cleanup" 절차에 따라 팀원 종료 (config에서 paneId 확보 → shutdown_request → tmux kill-pane) → TeamDelete

---

## PHASE 4: 검증 & 마무리 (강제, Leader 직접 수행)

### 1차: 기계적 검증 (verify→fix 루프)
- TypeCheck + Lint 병렬 실행 (단일 응답에서 2개 Bash 동시 호출)
- 실패 시 → 자동 수정 → 재검증 (최대 3회 루프)
- 이번 세션에서 수정한 파일의 오류만 수정, 나머지 무시

### 2차: 의미적 리뷰
- 이번 세션에서 수정한 파일 전체를 Read로 완독
- 논리적 오류, 일관성, 엣지케이스, 보안 취약점 점검
- 발견 시 자동 수정 → 1차(기계적 검증) 재실행

**사용자 선택** (AskUserQuestion):
- **1) Cleanup → Commit → /rrr** (GLM-5 코드 리뷰)
- **2) Cleanup → Commit만** (Push 없음)
- **3) Cleanup → Commit → Push**

**Cleanup + Commit** (선택 시):
- 리서치 파일 정리: `/tmp/ret-research/{team_name}/` 전체 삭제 (`rm -rf`), 프로젝트 디렉토리에 리서치 .md 혼입 여부 확인 → 발견 시 삭제
- 미사용 import/변수 제거, 임시 주석/디버그 코드 제거, `pnpm lint --fix`
- Conventional Commits + 학습 태그 형식
- `git add` 시 이번 세션에서 수정한 파일만 개별 명시 (`git add .` 금지)
- 옵션 1 선택 시: Cleanup → Commit → `/rrr` (GLM-5 코드 리뷰 스킬 호출)
- 옵션 2 선택 시: Cleanup → Commit만
- 옵션 3 선택 시: Cleanup → Commit → Push

---

## 체크포인트

- **PHASE 0, 1**: MANDATORY (미완료 시 구현 불가)
- **PHASE 2**: 사용자 승인 필수 → 승인 후 PHASE 3 실행
- **PHASE 3 완료**: 팀원 종료 + tmux pane kill (→ "tmux Pane Cleanup") → TeamDelete → PHASE 4
- **PHASE 4 완료**: 사용자 선택 필수 (Commit+/rrr / Commit만 / Commit+Push)

---

## 커밋 형식

Conventional Commits + 학습 태그:

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

| 태그 | 용도 |
|------|------|
| `[context]` | 향후 세션에 필요한 배경/맥락 |
| `[insight]` | 새로 배운 사실, 패턴, 베스트 프랙티스 |
| `[gotcha]` | 함정, 삽질 원인, 문서에 없는 주의사항 |
| `[decision]` | 설계/아키텍처 결정과 그 이유 |
| `[followup]` | 미완성 작업, 기술 부채, 후속 필요 사항 |

필수 아님 - 의미 있는 학습이 있을 때만 기록

---

## UI/UX 가이드라인 (권장)

**원칙**: shadcn/ui 컴포넌트 + 테마 변수 최대 활용

1. **shadcn 컴포넌트 우선**: 없으면 `pnpm dlx shadcn@latest add [component]`, shadcn에 없는 경우에만 커스텀
2. **테마 변수 사용 (하드코딩 금지)**:
   ```tsx
   // ❌ bg-blue-500 text-white border-gray-300
   // ✅ bg-primary text-primary-foreground border-border
   ```

---

## spawn prompt 템플릿

팀원 spawn 시 prompt에 반드시 포함할 내용:

```
당신은 "${name}" 팀원입니다. ${team_name} 팀에 소속되어 있습니다.

## 🚫 행동 제한 (최우선)
- **프로젝트 파일 수정 금지**: Leader가 구현을 명시적으로 위임하기 전까지 프로젝트 디렉토리의 파일을 Write/Edit하지 않는다. (리서치 파일은 `/tmp/ret-research/${team_name}/`에만 작성 가능)
- **구현 위임 시에도 범위 엄수**: Leader가 명시한 파일만 수정. 관련 있어 보여도 명시되지 않은 파일은 절대 수정 금지. 추가 수정이 필요하면 Leader에게 보고 후 승인받기.
- **git 명령 금지**: git add, commit, push, restore, checkout은 Leader만 수행한다. 팀원이 직접 커밋하거나 파일을 복원하는 것은 어떤 상황에서도 금지.
- WebFetch 사용 금지 (subagent/본인 모두). 웹페이지 접근은 Jina MCP 사용
- subagent 프롬프트에 반드시 "WebFetch 사용 금지. Context7 + WebSearch + Jina MCP 사용하세요." 명시
- 리서치 도구: Context7(공식 문서 신뢰도 최우선) + WebSearch + Jina MCP 자유롭게 활용

## 프로젝트 기술스택
/tmp/ret-research/{team_name}/tech-stack.md를 반드시 먼저 읽어 프로젝트 컨텍스트를 파악하세요.

## 역할
<구체적 역할 설명>

## 작업
<구체적 작업 지시>

## 보고
- 상세 분석은 /tmp/ret-research/{team_name}/[name]-report.md에 작성

## 팀 프로토콜
- 작업 시작: TaskGet → TaskUpdate(status: "in_progress")
- 작업 완료: TaskUpdate(status: "completed") → team-lead에게 결과 보고
- subagent 활용: Task 3~7개를 한 번의 응답에서 동시에 spawn, model: "haiku" (리서치/파일읽기만, 구현 위임 금지, 단순 3개/중간 4~5개/복잡 6~7개 자율 조절)
- ⚠️ Agent 도구로 subagent spawn 시 team_name 파라미터를 절대 포함하지 마세요. team_name을 포함하면 subagent가 아닌 새 팀원이 tmux pane으로 spawn됩니다.
- ⚠️ TeamCreate, TeamDelete 사용 금지 (Leader 전용)
- ⚠️ subagent 결과를 기다리는 중이면, 결과 수신 전에 반드시 team-lead에게 "subagent 대기 중, 완료되면 보고하겠습니다" 메시지를 보내세요. 결과를 모두 받고 정리한 뒤에 최종 보고하세요.
```

### 교체 spawn 보충 컨텍스트

팀원 교체 시 (Per-task Replacement) 새 팀원의 spawn prompt에 추가할 섹션:

```
## 이전 작업 컨텍스트
이 팀에서 이전에 완료된 관련 작업 요약:
- [이전 팀원이 완료한 태스크 및 핵심 결과 요약]
- [관련 결정사항 (decisions.md에서 발췌)]
- [이전 산출물 경로 (참조 필요 시)]

위 컨텍스트는 참고용이며, 새 태스크에 집중하세요.
상세가 필요하면 /tmp/ret-research/{team_name}/ 파일 참조.
```

**파라미터는 초기 spawn과 동일** (model: "sonnet", mode: "bypassPermissions")

---

## 작업 위임 메시지 규칙

Leader가 SendMessage로 팀원에게 작업을 위임/추가 지시할 때 반드시 준수:

**포함 문구 정책**:
- **첫 번째 위임 시**: 전체 리마인더 포함
  > ⚠️ 리마인더:
  > - WebFetch 사용 금지. 웹페이지 접근은 Jina MCP 사용
  > - 리서치 도구: Context7(공식 문서 신뢰도 최우선) + WebSearch + Jina MCP 자유롭게 활용
  > - 리서치 파일은 `/tmp/ret-research/{team_name}/`에만 작성. 프로젝트 디렉토리에 .md 생성 금지
- **이후 위임 시**: 축약 형태 사용
  > ⚠️ 표준 리마인더 적용 (spawn prompt 참조)

**이유**: 팀원은 독립 세션이라 spawn prompt 이후 컨텍스트가 희석될 수 있음. 첫 위임 시 전체 포함, 이후는 축약으로 토큰 절약.

---

## Spawn 실패 대응

1. **부분 실패**: 성공한 팀원으로 작업 진행 + 실패한 태스크를 재배분 또는 Leader가 직접 수행
2. **전체 실패**: TeamDelete → Leader가 단독으로 `/re` 워크플로우로 전환

---

## 전체 흐름 요약

```
PHASE 0 (강제): 컨텍스트 스냅샷 → TeamCreate → 팀원 5명 Sonnet spawn → 태스크 배분
    ↓
PHASE 1 (강제): 팀원 병렬 리서치/분석 (각 subagent 3~7개 동시, 복잡도에 따라 자율 조절) → Leader 종합
    ↓
PHASE 2 (강제): Sequential Thinking 종합 (자기검증 3질문 포함) → 3+ 옵션 → ⏸️ 사용자 승인
    ↓
PHASE 3 (자율): Leader가 orchestrator로서 팀원에게 위임 — 구현/추가리서치/방향전환 자유 (팀원 교체 정책 적용, 리더 규율 준수)
    ↓ (팀원 종료 + tmux pane kill → TeamDelete)
PHASE 4 (강제): Leader 직접 검증 → ⏸️ 사용자 선택 → Cleanup → Commit
```

---

**버전**: 5.9.0

**출처**: https://github.com/dgk-dev/dgk-claude
