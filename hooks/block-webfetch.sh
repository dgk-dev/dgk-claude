#!/bin/bash
# WebFetch 도구 차단 (PreToolUse hook)
# 이유: 타임아웃 미구현, Cloudflare 차단, hang 시 컨텍스트 손실 위험
# 대안: Jina MCP 사용 (공식 HTTP, 타임아웃 지원)

mkdir -p ~/.claude/logs
echo "$(date '+%Y-%m-%d %H:%M:%S') BLOCKED: WebFetch 사용 시도" >> ~/.claude/logs/blocked.log
echo "⛔ WebFetch 차단됨 — Jina MCP(mcp__jina__read_url)를 대신 사용하세요" >&2
exit 2
