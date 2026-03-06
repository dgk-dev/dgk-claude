# dgk-claude

[Claude Code](https://claude.ai/code) skills, hooks & workflows by dgk-dev.

리서치 기반 개발 워크플로우, 코드 리뷰, 보안 hooks 등을 포함합니다.

## Skills

| 스킬 | 설명 | 요구사항 |
|------|------|----------|
| `/re` | Research & Execute — 리서치 기반 솔로 워크플로우 (6단계 PHASE) | MCP 3개 (Context7, Jina, Sequential Thinking) |
| `/ret` | Team Research & Execute — Opus[1M] 리더 + 5 Sonnet 팀원 병렬 리서치/구현 | Max 플랜 + Agent Teams + tmux |
| `/rr` | Z.AI 코드 리뷰 (glm-4.7-flash, 무료) | [glm-review](https://github.com/dgk-dev/glm-review) + ZAI_API_KEY |
| `/rrr` | GLM-5 코드 리뷰 (744B, 유료) | glm-review + ZAI_API_KEY + GLM-5 플랜 |
| `/cp` | Commit & Push — 세션 수정 파일만 안전하게 커밋 | Git |

## Hooks

| Hook | 설명 | 이벤트 | 의존성 |
|------|------|--------|--------|
| `bash-guard.sh` | 위험 명령 차단 (rm -rf, force push 등) | PreToolUse | jq |
| `audit-log.sh` | Bash 사용 감사 로깅 | PreToolUse | jq |
| `block-webfetch.sh` | WebFetch 차단 (Jina MCP로 대체) | PreToolUse | 없음 |
| `handoff-load.sh` | 세션 시작 시 HANDOFF.md 자동 로드 | SessionStart | 없음 |
| `add-date.sh` | 현재 날짜 주입 (모델 연도 오해 방지) | SessionStart | date |
| `postwrite-check.sh` | TS 파일 수정 시 타입체크 권장 | PostToolUse | jq |
| `compact-reinject.sh` | compact 시 팀 컨텍스트 재주입 (Agent Teams용) | SessionStart(compact) | Agent Teams |
| `rtk-rewrite.sh` | 명령어를 rtk로 자동 리라이트 (선택적 — rtk 없으면 passthrough) | PreToolUse | rtk (선택) |
| `telegram-notify.sh` | Telegram 알림 (idle/permission 이벤트) | Notification | curl, jq, TELEGRAM_BOT_TOKEN |

## 설치

### 방법 1: 수동 복사 (가장 단순)

```bash
git clone https://github.com/dgk-dev/dgk-claude.git
cd dgk-claude

# 원하는 스킬만 복사
cp -r skills/re ~/.claude/skills/re
cp -r skills/cp ~/.claude/skills/cp

# 원하는 hooks만 복사
cp hooks/bash-guard.sh ~/.claude/hooks/
cp hooks/handoff-load.sh ~/.claude/hooks/
```

복사 후 `~/.claude/settings.json`의 `hooks` 섹션에 등록해야 합니다.

### 방법 2: 전체 설치

```bash
git clone https://github.com/dgk-dev/dgk-claude.git
cd dgk-claude
./install.sh
```

### /rr, /rrr 사용 시

[glm-review](https://github.com/dgk-dev/glm-review)를 먼저 설치하세요:

```bash
npm install -g glm-review
# 또는
npx glm-review --health
```

## 요구사항

### 필수
- Claude Code CLI
- Git
- jq (hooks용)

### /re 사용 시 추가
- Context7 MCP 서버 + API 키
- Jina MCP 서버 + API 키
- Sequential Thinking MCP 서버

### /ret 사용 시 추가
- 위 /re 요구사항 전부
- Max 플랜 (opus[1m] 모델)
- tmux
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

### /rr, /rrr 사용 시 추가
- [glm-review](https://github.com/dgk-dev/glm-review) CLI (`npm install -g glm-review`)
- [Z.AI](https://z.ai) API 키 (`ZAI_API_KEY`)
- /rrr: GLM-5 Pro/Max 플랜

## 라이선스

MIT
