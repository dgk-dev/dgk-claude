#!/bin/bash
LOG_DIR="$HOME/.claude/logs"
mkdir -p "$LOG_DIR"
input=$(cat)
tool=$(echo "$input" | jq -r '.tool_name')
cmd=$(echo "$input" | jq -r '.tool_input.command // .tool_input.file_path // "N/A"')
echo "$(date '+%Y-%m-%d %H:%M:%S') | $tool | $cmd" >> "$LOG_DIR/audit.log"
exit 0
