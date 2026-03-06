#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$HOME/.claude/skills"
HOOKS_DIR="$HOME/.claude/hooks"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[dgk-claude]${NC} $*"; }
success() { echo -e "${GREEN}[dgk-claude]${NC} $*"; }
warn()    { echo -e "${YELLOW}[dgk-claude]${NC} $*"; }

info "dgk-claude 설치를 시작합니다..."

# Skills 설치
mkdir -p "$SKILLS_DIR"
for skill_dir in "$SCRIPT_DIR"/skills/*/; do
  skill_name=$(basename "$skill_dir")
  target="$SKILLS_DIR/$skill_name"
  if [ -d "$target" ]; then
    warn "$skill_name: 이미 존재 — 스킵 (덮어쓰려면 수동으로 삭제 후 재실행)"
  else
    cp -r "$skill_dir" "$target"
    success "$skill_name 스킬 설치 완료"
  fi
done

# Hooks 설치
mkdir -p "$HOOKS_DIR"
for hook_file in "$SCRIPT_DIR"/hooks/*.sh; do
  hook_name=$(basename "$hook_file")
  target="$HOOKS_DIR/$hook_name"
  if [ -f "$target" ]; then
    warn "$hook_name: 이미 존재 — 스킵"
  else
    cp "$hook_file" "$target"
    chmod +x "$target"
    success "$hook_name hook 설치 완료"
  fi
done

echo ""
info "설치 완료!"
info ""
info "다음 단계:"
info "  1. ~/.claude/settings.json의 hooks 섹션에 hook 등록"
info "  2. /rr, /rrr 사용 시: npm install -g glm-review"
info "  3. Claude Code 재시작"
echo ""
