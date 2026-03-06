#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
SKILLS_DIR="$CLAUDE_DIR/skills"
HOOKS_DIR="$CLAUDE_DIR/hooks"
SETTINGS="$CLAUDE_DIR/settings.json"

# ── 색상 (터미널 지원 확인) ──────────────────────────────────
if [ -t 1 ] && command -v tput &>/dev/null && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; NC=''
fi

info()    { printf '%b[dgk-claude]%b %s\n' "$BLUE" "$NC" "$*"; }
success() { printf '%b[dgk-claude]%b %s\n' "$GREEN" "$NC" "$*"; }
warn()    { printf '%b[dgk-claude]%b %s\n' "$YELLOW" "$NC" "$*"; }
error()   { printf '%b[dgk-claude]%b %s\n' "$RED" "$NC" "$*" >&2; }
dim()     { printf '%b%s%b\n' "$CYAN" "$*" "$NC"; }

# ── 필수 도구 확인 ───────────────────────────────────────────
if ! command -v jq &>/dev/null; then
  error "jq가 필요합니다. 먼저 설치하세요:"
  error "  Linux:  sudo apt install jq"
  error "  macOS:  brew install jq"
  error "  Windows (Git Bash): choco install jq"
  exit 1
fi

# ── OS 감지 ──────────────────────────────────────────────────
OS="unknown"
case "$(uname -s)" in
  Linux*)   OS="linux" ;;
  Darwin*)  OS="macos" ;;
  MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
esac

# ── 설치 전 확인 (기존 환경 감지) ────────────────────────────
printf '\n'
info "dgk-claude 설치 준비 중... (OS: $OS)"
printf '\n'

# 기존 스킬 확인
EXISTING_SKILLS=()
for skill_dir in "$SCRIPT_DIR"/skills/*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  if [ -d "$SKILLS_DIR/$skill_name" ]; then
    EXISTING_SKILLS+=("$skill_name")
  fi
done

# 기존 hooks 확인
EXISTING_HOOKS=()
for hook_file in "$SCRIPT_DIR"/hooks/*.sh; do
  [ -f "$hook_file" ] || continue
  hook_name="$(basename "$hook_file")"
  if [ -f "$HOOKS_DIR/$hook_name" ]; then
    EXISTING_HOOKS+=("$hook_name")
  fi
done

# 기존 settings.json hooks 개수
EXISTING_HOOK_COUNT=0
if [ -f "$SETTINGS" ] && jq -e '.hooks' "$SETTINGS" &>/dev/null; then
  EXISTING_HOOK_COUNT=$(jq '[.hooks[]?[]?.hooks[]?] | length' "$SETTINGS" 2>/dev/null || echo 0)
fi

# 설치 계획 표시
info "=== 설치 계획 ==="
printf '\n'

# 스킬 계획
NEW_SKILL_COUNT=0
for skill_dir in "$SCRIPT_DIR"/skills/*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  if [ -d "$SKILLS_DIR/$skill_name" ]; then
    dim "  스킵  /$skill_name (이미 존재)"
  else
    info "  설치  /$skill_name"
    NEW_SKILL_COUNT=$((NEW_SKILL_COUNT + 1))
  fi
done

printf '\n'

# Hooks 계획
NEW_HOOK_COUNT=0
for hook_file in "$SCRIPT_DIR"/hooks/*.sh; do
  [ -f "$hook_file" ] || continue
  hook_name="$(basename "$hook_file")"
  if [ -f "$HOOKS_DIR/$hook_name" ]; then
    dim "  스킵  $hook_name (이미 존재)"
  else
    info "  설치  $hook_name"
    NEW_HOOK_COUNT=$((NEW_HOOK_COUNT + 1))
  fi
done

printf '\n'

# settings.json 계획
if [ "$EXISTING_HOOK_COUNT" -gt 0 ]; then
  info "  settings.json: 기존 hooks ${EXISTING_HOOK_COUNT}개 유지 + 새 hooks 추가 (중복 스킵)"
else
  info "  settings.json: hooks 섹션 새로 생성"
fi

# glm-review 계획
if command -v glm-review &>/dev/null; then
  dim "  스킵  glm-review (이미 설치됨)"
elif command -v npm &>/dev/null; then
  info "  설치  glm-review (npm install -g)"
else
  warn "  스킵  glm-review (npm 없음)"
fi

printf '\n'

# 설치할 것이 없으면 종료
if [ "$NEW_SKILL_COUNT" -eq 0 ] && [ "$NEW_HOOK_COUNT" -eq 0 ]; then
  success "이미 모든 스킬과 hooks가 설치되어 있습니다."
  printf '\n'
  exit 0
fi

# 확인 (npx로 실행 시 stdin이 없을 수 있으므로 -t 0 체크)
if [ -t 0 ]; then
  printf '%b[dgk-claude]%b 위 계획대로 설치를 진행할까요? [Y/n] ' "$BLUE" "$NC"
  read -r REPLY
  if [[ "$REPLY" =~ ^[Nn] ]]; then
    info "설치를 취소했습니다."
    exit 0
  fi
else
  info "비대화 모드 — 자동 설치 진행"
fi

printf '\n'

# ── Skills 설치 ──────────────────────────────────────────────
info "=== Skills 설치 ==="
mkdir -p "$SKILLS_DIR"
for skill_dir in "$SCRIPT_DIR"/skills/*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  target="$SKILLS_DIR/$skill_name"
  if [ -d "$target" ]; then
    warn "$skill_name: 이미 존재 — 스킵"
  else
    cp -r "$skill_dir" "$target"
    success "$skill_name 스킬 설치 완료"
  fi
done

# ── Hooks 파일 설치 ──────────────────────────────────────────
printf '\n'
info "=== Hooks 파일 설치 ==="
mkdir -p "$HOOKS_DIR"
for hook_file in "$SCRIPT_DIR"/hooks/*.sh; do
  [ -f "$hook_file" ] || continue
  hook_name="$(basename "$hook_file")"
  target="$HOOKS_DIR/$hook_name"
  if [ -f "$target" ]; then
    warn "$hook_name: 이미 존재 — 스킵"
  else
    cp "$hook_file" "$target"
    chmod +x "$target" 2>/dev/null || true
    success "$hook_name 설치 완료"
  fi
done

# ── settings.json에 hooks 등록 ──────────────────────────────
printf '\n'
info "=== settings.json hooks 등록 ==="

if [ ! -f "$SETTINGS" ]; then
  printf '{}' > "$SETTINGS"
  info "settings.json 생성"
fi

if ! jq empty "$SETTINGS" 2>/dev/null; then
  error "settings.json이 유효한 JSON이 아닙니다. 수동으로 확인하세요: $SETTINGS"
  exit 1
fi

if ! jq -e '.hooks' "$SETTINGS" &>/dev/null; then
  jq '. + {"hooks": {}}' "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"
fi

register_hook() {
  local event="$1"
  local matcher="$2"
  local script="$3"
  local cmd="bash $HOOKS_DIR/$script"

  if jq -e ".hooks[\"$event\"][]?.hooks[]? | select(.command == \"$cmd\")" "$SETTINGS" &>/dev/null; then
    warn "$script: 이미 등록됨 — 스킵"
    return
  fi

  jq --arg event "$event" --arg matcher "$matcher" --arg cmd "$cmd" '
    .hooks[$event] //= [] |
    .hooks[$event] |= (
      if any(.[]; .matcher == $matcher)
      then map(if .matcher == $matcher then .hooks += [{"type": "command", "command": $cmd}] else . end)
      else . + [{"matcher": $matcher, "hooks": [{"type": "command", "command": $cmd}]}]
      end
    )
  ' "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"
  success "$script → $event${matcher:+ ($matcher)}"
}

register_hook "SessionStart" "" "add-date.sh"
register_hook "SessionStart" "" "handoff-load.sh"
register_hook "SessionStart" "compact" "compact-reinject.sh"
register_hook "PreToolUse" "Bash" "bash-guard.sh"
register_hook "PreToolUse" "Bash" "audit-log.sh"
register_hook "PreToolUse" "Bash" "rtk-rewrite.sh"
register_hook "PreToolUse" "WebFetch" "block-webfetch.sh"
register_hook "PostToolUse" "Write|Edit" "postwrite-check.sh"
register_hook "Notification" "" "telegram-notify.sh"

# ── glm-review 설치 (/rr, /rrr 코드 리뷰) ───────────────────
printf '\n'
info "=== glm-review 설치 (코드 리뷰) ==="
if command -v npm &>/dev/null; then
  if command -v glm-review &>/dev/null; then
    warn "glm-review: 이미 설치됨 — 스킵"
  else
    info "npm install -g glm-review 실행 중..."
    if npm install -g glm-review 2>/dev/null; then
      success "glm-review 설치 완료 — /rr, /rrr 사용 가능"
    else
      warn "glm-review 설치 실패 (권한 문제일 수 있음). 수동 설치: npm install -g glm-review"
    fi
  fi
else
  warn "npm 미설치 — glm-review 스킵. /rr, /rrr 사용하려면 Node.js 설치 후: npm install -g glm-review"
fi

# ── 완료 ─────────────────────────────────────────────────────
printf '\n'
success "설치 완료!"
printf '\n'
info "다음 단계:"
info "  1. Claude Code 재시작"
info "  2. /rr, /rrr 사용 시: ZAI_API_KEY 설정 필요 — echo \"ZAI_API_KEY='키값'\" >> ~/.claude/.env.local"
info "  3. Telegram 알림 사용 시: ~/.claude/.env.local에 TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 추가"
info "  4. /re, /ret 사용 시: MCP 서버 설정 (README 참조)"
printf '\n'
