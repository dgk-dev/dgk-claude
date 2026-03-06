#!/usr/bin/env bash
# Claude Code 날짜 인식 강화 Hook
# 모델이 2024/2025로 오해하는 것 방지

CURRENT_DATE=$(date '+%Y-%m-%d')
CURRENT_TIME=$(date '+%H:%M %Z')
CURRENT_YEAR=$(date '+%Y')

echo "[CONTEXT] Today is ${CURRENT_DATE} (${CURRENT_TIME}). Current year is ${CURRENT_YEAR}. Always use ${CURRENT_YEAR} for searches and documentation."
