#!/bin/bash
# compact 후 팀 컨텍스트 재주입
# compact 이벤트 발생 시 SessionStart(matcher: "compact")에서 호출됨

TEAM_DIR="$HOME/.claude/teams"

# 활성 팀이 있는지 확인
if [ -d "$TEAM_DIR" ] && [ "$(ls -A "$TEAM_DIR" 2>/dev/null)" ]; then
    for TEAM_NAME in $(ls "$TEAM_DIR"); do
        echo "[COMPACT 복구] 활성 팀: $TEAM_NAME"
        echo "팀 config: $TEAM_DIR/$TEAM_NAME/config.json"

        # decisions.md 존재 확인 (팀 이름 기반 경로)
        if [ -f "/tmp/ret-research/$TEAM_NAME/decisions.md" ]; then
            echo "decisions 파일: /tmp/ret-research/$TEAM_NAME/decisions.md"
        fi

        # 팀원 보고서 디렉토리 확인
        if [ -d "/tmp/ret-research/$TEAM_NAME" ]; then
            echo "팀원 보고서: /tmp/ret-research/$TEAM_NAME/"
        fi
    done

    echo "이전 작업을 이어서 진행하세요. decisions.md를 읽어 맥락을 복구하세요."
fi
