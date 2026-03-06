---
allowed-tools: [Bash, Read, Grep]
description: "Commit & Push. 이 세션에서 수정한 파일만 커밋 + main 푸시."
argument-hint: "커밋 메시지 (선택). 없으면 자동 생성"
disable-model-invocation: false
---

# /cp - Commit & Push

**이 세션에서 수정한 파일만** 커밋하고 main에 푸시한다.

## 핵심 원칙: 세션 격리

> 사용자는 여러 터미널 탭에서 동시에 Claude Code를 실행한다.
> `/cp`는 **현재 대화에서 Write/Edit/Bash로 수정한 파일만** 커밋해야 한다.
> 다른 세션의 uncommitted 변경을 절대 건드리지 않는다.

## 실행 절차

### 1. 세션 수정 파일 식별 (가장 중요)

현재 대화 히스토리를 역추적하여 **이 세션에서 Write/Edit/Bash 도구로 수정한 파일 목록**을 확정한다.
- 대화에서 수정한 파일만 포함
- `git diff`에 보이지만 이 세션에서 건드리지 않은 파일은 **무시**

### 2. 상태 확인

```bash
git status        # 전체 변경 파일 확인
git diff --staged # 이미 staged된 것 확인
git log --oneline -5  # 커밋 메시지 스타일 확인
```

### 3. 교차 검증

- `git status`의 변경 파일 목록과 세션 수정 파일 목록을 대조
- **세션 목록에 있는데 git status에 없는 파일**: 이미 커밋됨 → 스킵
- **git status에 있는데 세션 목록에 없는 파일**: 다른 세션 작업 → 절대 add 금지
- 겹치는 파일만 커밋 대상

### 4. 사용자에게 파일 목록 보여주고 확인 없이 바로 진행

세션 수정 파일이 명확하면 확인 없이 바로 커밋+푸시한다.
단, 다른 세션 변경이 많이 보이면 한줄로 "N개 파일은 다른 세션 변경 — 스킵" 안내.

### 5. 커밋 + 푸시

```bash
git add <세션-수정-파일들-개별-지정>
git commit -m "$(cat <<'EOF'
type(scope): 메시지

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin $(git symbolic-ref --short HEAD)
```

### 6. 결과 보고 (간결하게)

커밋 해시 + 푸시 결과 한줄.

## 커밋 메시지

- 사용자가 인자로 줬으면 그대로 사용
- 없으면 변경 내용 분석 → Conventional Commit 자동 생성
- 형식: `type(scope): 한국어 요약`

## 금지 사항

- `git add .` / `git add -A` 금지
- 세션 외 파일 add 금지
- amend 금지 (항상 새 커밋)
- 민감 파일 (.env, credentials) 감지 시 제외
