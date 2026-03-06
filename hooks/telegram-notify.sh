#!/bin/bash
# Claude Code Telegram Notification Hook
# Usage: telegram-notify.sh "emoji" "hook_type"
#
# Team mode: only notifies for the team leader (skips teammate events)
# Detection: matches session_id against leadSessionId in team configs

EMOJI=$1
HOOK_TYPE=$2

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // "unknown"' 2>/dev/null)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""' 2>/dev/null)
DIR_NAME=$(basename "$CWD" 2>/dev/null || echo "unknown")

# Check if this session is a teammate (not the leader) in any active team
is_teammate() {
    local sid="$1"
    [ -z "$sid" ] && return 1
    for config in ~/.claude/teams/*/config.json; do
        [ -f "$config" ] || continue
        local leader_sid
        leader_sid=$(jq -r '.leadSessionId // ""' "$config" 2>/dev/null)
        # Team is active: if we match the leader, we're NOT a teammate
        if [ "$sid" = "$leader_sid" ]; then
            return 1
        fi
        # Check if our session appears as a non-leader member
        if jq -e ".members[1:] | .[] | select(.agentId | test(\"$sid\"))" "$config" >/dev/null 2>&1; then
            return 0
        fi
    done
    # No match found — could be leader of a team not yet in config, or no team at all
    return 1
}

# Skip notifications from teammates
if is_teammate "$SESSION_ID"; then
    exit 0
fi

if [ -f ~/.claude/.env.local ]; then
    set -a
    source ~/.claude/.env.local
    set +a
fi

MESSAGE="${EMOJI} Done — waiting in ${DIR_NAME}"

if [ -n "${TELEGRAM_BOT_TOKEN}" ] && [ -n "${TELEGRAM_CHAT_ID}" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=${MESSAGE}" \
        -d "parse_mode=HTML" > /dev/null 2>&1
fi
