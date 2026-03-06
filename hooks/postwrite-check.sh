#!/bin/bash
# PostToolUse: Write/Edit 후 TypeScript 프로젝트면 타입체크 권장 메시지 출력
# 차단하지 않음 (exit 0). 정보 제공만.

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

# Write 또는 Edit만 처리
case "$tool_name" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file_path" ] && exit 0

# TypeScript 파일만 처리
case "$file_path" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# tsconfig.json 존재 여부 확인 (상위 3단계까지)
check_dir="$(dirname "$file_path")"
for _ in 1 2 3; do
  if [ -f "$check_dir/tsconfig.json" ]; then
    echo "[PostWrite] TS 파일 수정됨: $(basename "$file_path") — 타입체크 권장: npx tsc --noEmit"
    exit 0
  fi
  check_dir="$(dirname "$check_dir")"
done

exit 0
