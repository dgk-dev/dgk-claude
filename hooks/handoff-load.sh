#!/usr/bin/env bash
# HANDOFF.md SessionStart Hook
# 현재 프로젝트 디렉토리에 handoff.md가 있으면 세션에 주입

# 확인할 경로 (우선순위순)
PATHS=(
  ".claude/handoff.md"
  "HANDOFF.md"
  "handoff.md"
)

for p in "${PATHS[@]}"; do
  if [[ -f "$p" ]]; then
    echo "[HANDOFF] 이전 세션의 handoff 파일을 발견했습니다 ($p):"
    echo "---"
    cat "$p"
    echo "---"
    echo "[HANDOFF] 위 내용을 참고하여 작업을 이어가세요. 작업 완료 후 handoff 파일을 갱신하거나 삭제하세요."
    exit 0
  fi
done

# handoff 파일 없으면 조용히 종료
exit 0
