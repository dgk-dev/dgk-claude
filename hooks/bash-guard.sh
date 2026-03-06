#!/bin/bash
input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')
[[ "$tool_name" != "Bash" ]] && exit 0

command=$(echo "$input" | jq -r '.tool_input.command // empty')
[[ -z "$command" ]] && exit 0

# 안전 패턴 (false positive 방지)
[[ "$command" =~ ^(ls|pwd|echo|cat|git\ status|git\ log|git\ diff|git\ branch) ]] && exit 0

# 위험 패턴 차단
BLOCKED=false
REASON=""

if [[ "$command" =~ chmod[[:space:]]+777 ]]; then BLOCKED=true; REASON="chmod 777 금지"
elif [[ "$command" =~ curl.*\|.*sh ]]; then BLOCKED=true; REASON="원격 스크립트 실행 금지"
elif [[ "$command" =~ wget.*\|.*sh ]]; then BLOCKED=true; REASON="원격 스크립트 실행 금지"
elif [[ "$command" =~ git.*push.*--force ]]; then BLOCKED=true; REASON="force push 금지"
elif [[ "$command" =~ git.*push.*-f[[:space:]] ]]; then BLOCKED=true; REASON="force push 금지"
elif [[ "$command" =~ git.*reset.*--hard ]]; then BLOCKED=true; REASON="hard reset 금지"
elif [[ "$command" =~ git[[:space:]]+restore ]]; then BLOCKED=true; REASON="git restore 금지 (다른 세션 작업 파괴 위험)"
elif [[ "$command" =~ git[[:space:]]+checkout[[:space:]]+-- ]]; then BLOCKED=true; REASON="git checkout -- 금지 (다른 세션 작업 파괴 위험)"
elif [[ "$command" =~ git.*clean.*-f ]]; then BLOCKED=true; REASON="git clean 금지"
elif [[ "$command" =~ dd[[:space:]]+if= ]]; then BLOCKED=true; REASON="dd 명령 금지"
elif [[ "$command" =~ mkfs ]]; then BLOCKED=true; REASON="mkfs 금지"
elif [[ "$command" =~ kill.*-9.*-1 ]]; then BLOCKED=true; REASON="전체 프로세스 종료 금지"
fi

if $BLOCKED; then
    mkdir -p ~/.claude/logs
    echo "$(date '+%Y-%m-%d %H:%M:%S') BLOCKED: $command ($REASON)" >> ~/.claude/logs/blocked.log
    echo "⛔ 차단됨: $REASON — 명령: $command" >&2
    exit 2
fi
exit 0
