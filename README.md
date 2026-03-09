# dgk-claude

[Claude Code](https://claude.ai/code) skills & hooks — 리서치 기반 개발 워크플로우, AI 코드 리뷰, 보안 hooks.

## 빠른 설치

```bash
npx dgk-claude
```

기본 동작:
- 스킬 5개 + hooks 9개를 `~/.claude`에 설치합니다.
- 기존 `settings.json`은 유지한 채 `dgk-claude` hooks만 병합합니다.
- 이미 있는 동일 스킬/훅은 최신 버전과 다를 때만 업데이트하고, 바꾸기 전 백업합니다.
- hooks는 Node 기반으로 등록되어 `jq`나 패키지 전용 bash 의존이 없습니다.

옵션:

```bash
npx dgk-claude --dry-run
npx dgk-claude --check-ret
npx dgk-claude --check-ret --install-system-deps
npx dgk-claude --yes
npx dgk-claude --skip-glm-review
```

환경 메모:
- macOS, Linux, WSL, Windows에서 같은 설치기로 동작합니다.
- 단, Claude Code 자체는 Anthropic 공식 문서 기준 Windows에서 Git Bash 환경을 전제로 합니다. 이건 `dgk-claude`가 아니라 Claude Code 런타임 요구사항입니다.
- `handoff-load` hook은 `handoff.md`뿐 아니라 `STATE.md`도 자동으로 읽어 세션 복구에 활용합니다.
- `/ret`를 쓰기 전에 `npx dgk-claude --check-ret`로 tmux, MCP, 로컬 준비 상태를 바로 점검할 수 있습니다.

---

## Skills

### `/re` — Research & Execute (솔로 워크플로우)

> "리서치 없이 구현 없다"

모든 구현 전에 리서치를 강제하는 6단계 워크플로우.

```
/re user authentication
```

| PHASE | 이름 | 설명 |
|:-----:|------|------|
| 1 | 컨텍스트 파악 | 프로젝트 구조, 기존 패턴, 기술스택 확인 |
| 2 | 리서치 | subagent 3~7개 병렬 투입. Context7(공식 문서) + WebSearch + Jina MCP로 교차 검증 |
| 3 | 코드베이스 분석 | 기존 코드 전체를 읽고 통합 지점 파악 |
| 4 | 계획 수립 | 3가지 이상 옵션 비교 → 최적안 추천 → **사용자 승인 대기** |
| 5 | 구현 & 검증 | TypeCheck + Lint 자동 루프, 의미적 리뷰 |
| 6 | 커밋 | Conventional Commits + 학습 태그 (`[context]`, `[gotcha]`, `[insight]`) |

**핵심 원칙**:
- 항상 최소 3가지 접근법을 비교한 후 최적안 추천
- 작업량/시간 무관 — 최종 품질만 고려
- AskUserQuestion으로 방향과 의도를 최대한 맞추면서 진행

**요구사항**: Context7 MCP + Jina MCP + Sequential Thinking MCP

---

### `/ret` — Team Research & Execute (팀 워크플로우)

> Opus[1M] 리더 + 5 Sonnet 팀원이 병렬로 리서치하고 구현

```
/ret implement payment system
```

| PHASE | 설명 |
|:-----:|------|
| 0 | 팀 생성 — TeamCreate + 5명 Sonnet spawn (tmux pane) |
| 1 | 병렬 리서치 — 팀원 5명이 각각 subagent 3~7개로 병렬 조사 |
| 2 | 계획 수립 — Sequential Thinking으로 종합 → 3+ 옵션 → **사용자 승인** |
| 3 | 자율 실행 — Leader가 orchestrator로 팀원에게 구현 위임 |
| 4 | 검증 — TypeCheck + Lint + 의미적 리뷰 → 커밋 |

**핵심 특징**:
- 팀원 idle ≠ 작업 완료 (subagent 결과 대기 중일 수 있음)
- 파일 충돌 방지 — 같은 파일을 두 에이전트가 동시 수정 금지
- 리서치 파일은 `/tmp/ret-research/`에 격리
- 팀원 교체 정책 — 태스크 완료 후 컨텍스트 관련성에 따라 교체/유지 판단

**요구사항**: Max 플랜 (opus[1m]) + Agent Teams + tmux + MCP 3개

빠른 점검:

```bash
npx dgk-claude --check-ret
```

tmux가 없으면 OS별 설치 명령을 안내하고, `--install-system-deps`를 주면 지원되는 환경에서는 자동 설치를 시도합니다.

---

### `/rr` — Z.AI 코드 리뷰 (무료)

> 커밋 전에 `/rr` 한 줄이면 Z.AI가 코드를 리뷰하고, Claude가 수정까지 해줌

```
/rr                  # uncommitted 변경사항 리뷰
/rr staged           # staged만
/rr pr               # PR diff 리뷰
/rr 보안 집중         # 커스텀 지시사항
```

동작 흐름:
1. glm-review CLI가 백그라운드에서 Z.AI API 호출 (glm-4.7-flash, 무료)
2. 리뷰 완료 후 Claude가 결과 검증 (오탐 필터링)
3. 유효한 이슈만 보고 → 자동 수정

**요구사항**: [glm-review](https://github.com/dgk-dev/glm-review) + ZAI_API_KEY

---

### `/rrr` — GLM-5 코드 리뷰 (유료)

`/rr`과 동일하지만 **GLM-5 (744B)** 모델 사용. 더 깊고 정밀한 리뷰.

```
/rrr                 # GLM-5로 리뷰
```

**추가 요구사항**: Z.AI GLM-5 Pro/Max 플랜

---

### `/cp` — Commit & Push

> 현재 세션에서 수정한 파일만 안전하게 커밋 + push

```
/cp                     # 자동 커밋 메시지
/cp fix: login bug      # 커밋 메시지 지정
```

**핵심**: 여러 터미널에서 동시에 Claude Code를 쓸 때, 다른 세션의 uncommitted 변경을 절대 건드리지 않음.
- `git add .` 금지 — 세션에서 수정한 파일만 개별 지정
- amend 금지 — 항상 새 커밋
- 민감 파일 (.env, credentials) 자동 감지 후 제외

**요구사항**: Git만

---

## Hooks

### bash-guard.js — 위험 명령 차단

Claude가 실수로 위험한 명령을 실행하는 것을 차단합니다.

**차단 목록**:
- `git push --force`, `git reset --hard`, `git restore`, `git clean -f`
- `chmod 777`, `curl | sh`, `dd if=`, `mkfs`
- `kill -9 -1` (전체 프로세스 종료)

차단 시 `~/.claude/logs/blocked.log`에 기록.

### audit-log.js — Bash 사용 로깅

Claude가 실행하는 모든 Bash 명령을 `~/.claude/logs/`에 기록. 사후 감사용.

### block-webfetch.js — WebFetch 차단

WebFetch 도구 사용을 차단하고 Jina MCP로 대체하도록 강제. WebFetch는 타임아웃 미구현으로 hang 위험이 있음.

### handoff-load.js — HANDOFF/STATE 자동 로드

세션 시작 시 `handoff.md` 또는 `STATE.md`가 있으면 자동으로 컨텍스트에 주입. 세션 간 작업 인계와 context rot 완화에 사용.

### add-date.js — 날짜 주입

현재 날짜를 모델에 주입. Claude가 현재 연도를 오해하는 것을 방지.

### postwrite-check.js — TypeScript 타입체크 권장

`.ts`/`.tsx` 파일을 Write/Edit한 후 타입체크 실행을 권장.

### compact-reinject.js — 팀 컨텍스트 재주입

Agent Teams 사용 시 context compact가 발생하면 팀 이름, PHASE, decisions.md 경로를 재주입.

### rtk-rewrite.js — rtk 자동 리라이트

[rtk](https://github.com/dgk-dev/rtk) (토큰 절약 CLI)가 설치되어 있으면 `ls`, `git log` 등의 명령을 자동으로 rtk 래핑. **rtk가 없으면 아무 일도 안 함** (passthrough).

### telegram-notify.js — Telegram 알림

Claude Code가 idle/permission 상태가 되면 Telegram으로 알림. `~/.claude/.env.local`에 `TELEGRAM_BOT_TOKEN`과 `TELEGRAM_CHAT_ID`가 설정되어 있을 때만 작동.

---

## 설치

### 원라인 설치 (추천)

```bash
npx dgk-claude
```

### git clone 설치

```bash
git clone https://github.com/dgk-dev/dgk-claude.git
cd dgk-claude
./install.sh
```

### curl 설치

```bash
curl -fsSL https://raw.githubusercontent.com/dgk-dev/dgk-claude/main/install-remote.sh | bash
```

`curl` 경로도 내부적으로 Node 설치기를 호출합니다.

### 선택적 설치 (원하는 것만)

```bash
git clone https://github.com/dgk-dev/dgk-claude.git
cd dgk-claude

# 스킬 선택
cp -r skills/re ~/.claude/skills/re
cp -r skills/cp ~/.claude/skills/cp

# hooks 선택
cp hooks/bash-guard.js ~/.claude/hooks/
cp hooks/handoff-load.js ~/.claude/hooks/
```

선택적 설치 시 `~/.claude/settings.json`의 hooks 섹션에 수동 등록 필요.

### /rr, /rrr 코드 리뷰 사용 시

```bash
npm install -g glm-review
```

Z.AI API 키 설정:
```bash
echo "ZAI_API_KEY='your-api-key'" >> ~/.claude/.env.local
```

[Z.AI](https://z.ai) Coding Plan 가입 후 API 키 발급.

---

## MCP 서버 설정 (/re, /ret 필수)

`/re`와 `/ret`는 3개 MCP 서버가 필요합니다.

```bash
# Context7 — 공식 문서 조회
claude mcp add context7-mcp -- npx -y @context7/mcp

# Jina — 웹페이지 본문 추출 (WebFetch 대체)
claude mcp add jina -- npx -y @jina-ai/mcp-server

# Sequential Thinking — 구조적 사고
claude mcp add sequential-thinking -- npx -y @anthropic/sequential-thinking-mcp
```

API 키가 필요한 경우 각 서비스에서 발급 후 `~/.claude/.env.local`에 추가:
```
CONTEXT7_API_KEY=your-key
JINA_API_KEY=your-key
```

---

## 요구사항 요약

| 기능 | Node 18+ | Claude Code | Git | MCP 3개 | Max 플랜 | tmux | glm-review | ZAI_API_KEY |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 설치기 | O | | | | | | | |
| `/cp` | | O | O | | | | | |
| `/re` | | O | O | O | | | | |
| `/ret` | | O | O | O | O | O | | |
| `/ret` 프리플라이트 | | | | 점검 | 수동 확인 | 점검/설치 | | |
| `/rr` | | O | O | | | | O | O |
| `/rrr` | | O | O | | | | O | O |
| hooks | | O | | | | | | |

---

## 라이선스

[MIT](LICENSE)
