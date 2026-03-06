#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
SKILLS_DIR="$CLAUDE_DIR/skills"
HOOKS_DIR="$CLAUDE_DIR/hooks"
SETTINGS="$CLAUDE_DIR/settings.json"

# ── 색상 (터미널 지원 확인) ──────────────────────────────────
if [ -t 1 ] && command -v tput &>/dev/null && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

info()    { printf '%b[dgk-claude]%b %s\n' "$BLUE" "$NC" "$*"; }
success() { printf '%b[dgk-claude]%b %s\n' "$GREEN" "$NC" "$*"; }
warn()    { printf '%b[dgk-claude]%b %s\n' "$YELLOW" "$NC" "$*"; }
error()   { printf '%b[dgk-claude]%b %s\n' "$RED" "$NC" "$*" >&2; }

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

info "dgk-claude 설치를 시작합니다... (OS: $OS)"
printf '\n'

# ── Skills 설치 ──────────────────────────────────────────────
info "=== Skills 설치 ==="
mkdir -p "$SKILLS_DIR"
for skill_dir in "$SCRIPT_DIR"/skills/*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  target="$SKILLS_DIR/$skill_name"
  if [ -d "$target" ]; then
    warn "$skill_name: 이미 존재 — 스킵 (덮어쓰려면 수동으로 삭제 후 재실행)"
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
    # chmod는 Windows Git Bash에서 실패할 수 있으므로 무시
    chmod +x "$target" 2>/dev/null || true
    success "$hook_name 설치 완료"
  fi
done

# ── settings.json에 hooks 등록 ──────────────────────────────
printf '\n'
info "=== settings.json hooks 등록 ==="

# settings.json이 없으면 기본 구조 생성
if [ ! -f "$SETTINGS" ]; then
  printf '{}' > "$SETTINGS"
  info "settings.json 생성"
fi

# JSON 유효성 확인
if ! jq empty "$SETTINGS" 2>/dev/null; then
  error "settings.json이 유효한 JSON이 아닙니다. 수동으로 확인하세요: $SETTINGS"
  exit 1
fi

# hooks 섹션이 없으면 추가
if ! jq -e '.hooks' "$SETTINGS" &>/dev/null; then
  jq '. + {"hooks": {}}' "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"
fi

register_hook() {
  local event="$1"
  local matcher="$2"
  local script="$3"
  local cmd="bash $HOOKS_DIR/$script"

  # 이미 등록되어 있는지 확인 (command 문자열 비교)
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

# SessionStart hooks
register_hook "SessionStart" "" "add-date.sh"
register_hook "SessionStart" "" "handoff-load.sh"
register_hook "SessionStart" "compact" "compact-reinject.sh"

# PreToolUse hooks
register_hook "PreToolUse" "Bash" "bash-guard.sh"
register_hook "PreToolUse" "Bash" "audit-log.sh"
register_hook "PreToolUse" "Bash" "rtk-rewrite.sh"
register_hook "PreToolUse" "WebFetch" "block-webfetch.sh"

# PostToolUse hooks
register_hook "PostToolUse" "Write|Edit" "postwrite-check.sh"

# Notification hooks
register_hook "Notification" "" "telegram-notify.sh"

# ── 완료 ─────────────────────────────────────────────────────
printf '\n'
success "설치 완료!"
printf '\n'
info "다음 단계:"
info "  1. Claude Code 재시작"
info "  2. /rr, /rrr 사용 시: npm install -g glm-review + ZAI_API_KEY 설정"
info "  3. Telegram 알림 사용 시: ~/.claude/.env.local에 TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 추가"
info "  4. /re, /ret 사용 시: MCP 서버 설정 (README 참조)"
printf '\n'
