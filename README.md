# dgk-claude

클로드코드 2시간, 3시간 넘게 돌리면 꼭 한 번씩 무너집니다.

리서치 없이 바로 코딩합니다.  
커밋 전에 한 번 더 볼 장치가 없습니다.  
세션이 길어지면 맥락이 흐려집니다.  
쓸데없는 명령에 토큰을 태웁니다.  
가끔은 위험한 명령도 툭 던집니다.

`dgk-claude`는 그걸 줄이기 위해 만든 실전 셋업입니다.

클로드코드 5,000시간 넘게 돌려본 뒤 남긴 조합입니다.  
이것저것 붙인 셋업이 아닙니다.  
실제 작업에서 살아남은 것만 남긴 조합입니다.

## 설치

```bash
npx dgk-claude
```

설치하면 바로 들어가는 것:
- `/re` 혼자 작업할 때 쓰는 리서치 + 구현 모드
- `/ret` 크게 돌릴 때 쓰는 팀 모드
- `/rr` 커밋 전에 한 번 더 보는 무료 AI 코드리뷰
- `/rrr` 더 깊게 보는 GLM-5 리뷰
- `/cp` 지금 세션에서 건드린 파일만 안전하게 commit + push
- hooks 9개로 날짜 주입, 세션 복구, 위험 명령 차단, 토큰 절약, 알림까지 자동화

## 왜 이걸 쓰는가

클로드코드는 기본만 써도 강합니다.

그런데 오래 쓰면 병목이 보입니다.
- 리서치 없이 바로 구현해서 다시 뜯어고침
- 대화가 길어지면 맥락이 흐려짐
- noisy command가 컨텍스트를 잡아먹음
- 커밋 전에 검토가 한 번 더 없어서 찜찜함
- 여러 세션이 섞이면 git이 더러워짐

`dgk-claude`는 이 다섯 가지를 줄이는 데 집중합니다.

한 줄로 말하면 이겁니다.

> 리서치, 구현, 검토, 커밋, 세션 복구를 한 번에 묶은 Claude Code 실전 셋업

## 먼저 쓸 것

대부분은 이것만 알면 됩니다.

### `/re`

대부분은 `/re`부터 쓰면 됩니다.

혼자 작업할 때 쓰는 기본 모드입니다.  
막무가내 구현 모드가 아닙니다.  
공식 문서, 웹 리서치, 코드베이스 분석을 먼저 하고 들어갑니다.

이런 사람에게 맞습니다:
- “일단 구현했다가 나중에 갈아엎는 일”이 잦은 사람
- 클로드코드가 예전 패턴이나 틀린 문서를 참고하는 게 싫은 사람
- 작은 기능부터 큰 기능까지 혼자 안정적으로 밀고 싶은 사람

```text
/re user authentication
```

핵심 흐름:
1. 프로젝트와 기존 패턴 파악
2. Context7 + WebSearch + Jina로 교차 검증
3. 코드베이스 전체 분석
4. 최소 3가지 옵션 비교
5. 구현
6. 검증
7. 커밋

필요한 것:
- Context7 MCP
- Jina MCP
- Sequential Thinking MCP

### `/ret`

혼자 하기 버거운 작업은 `/ret`입니다.

큰 작업용 팀 모드입니다.  
혼자 하나씩 보는 게 아니라, 여러 에이전트를 병렬로 굴려서 리서치하고 구현합니다.

이런 상황에 맞습니다:
- 큰 기능 하나를 한 번에 밀 때
- 리팩터링 범위가 넓을 때
- 의존성이 많은 작업이라 조사와 구현을 분리해야 할 때
- 여러 에이전트를 붙여도 충돌 없이 굴리고 싶을 때

```text
/ret implement payment system
```

핵심 흐름:
1. 팀 생성
2. 팀원 5명이 병렬 리서치
3. Leader가 옵션 비교 후 계획 수립
4. 팀원에게 구현 분배
5. 검증 후 정리

이 모드는 진짜로 큰 작업용입니다.  
작업이 작으면 `/re`가 더 낫습니다.

필요한 것:
- Max 플랜
- Agent Teams
- tmux
- Context7 MCP
- Jina MCP
- Sequential Thinking MCP

빠른 점검:

```bash
npx dgk-claude --check-ret
```

tmux가 없으면 설치 명령을 바로 안내합니다.  
지원되는 환경에서는 아래처럼 자동 설치도 시도할 수 있습니다.

```bash
npx dgk-claude --check-ret --install-system-deps
```

### `/rr`

커밋 전에 가장 아쉬운 한 칸을 메우는 게 `/rr`입니다.

무료 AI 코드리뷰입니다.  
커밋 전에 `/rr` 한 줄이면 리뷰를 한 번 더 거칩니다.  
그냥 칭찬하는 리뷰가 아닙니다.  
실제 변경사항을 보고 다시 검증하는 흐름입니다.

```text
/rr
/rr staged
/rr pr
/rr 보안 집중
```

핵심 흐름:
1. `glm-review`가 리뷰 수행
2. Claude가 결과를 다시 검증
3. 오탐을 거른 뒤 유효한 이슈만 보고
4. 필요하면 바로 수정

필요한 것:
- [`glm-review`](https://github.com/dgk-dev/glm-review)
- `ZAI_API_KEY`

### `/rrr`

`/rr`의 더 깊은 버전입니다.

GLM-5로 더 세게 봅니다.

```text
/rrr
```

필요한 것:
- `glm-review`
- `ZAI_API_KEY`
- Z.AI GLM-5 Pro/Max 플랜

### `/cp`

마지막은 `/cp`로 닫습니다.

지금 세션에서 건드린 파일만 안전하게 commit + push 합니다.

```text
/cp
/cp fix: login bug
```

이 모드는 특히 여러 터미널에서 동시에 클로드코드를 돌릴 때 강합니다.

지키는 원칙:
- `git add .` 금지
- amend 금지
- 세션에서 수정한 파일만 지정
- 민감 파일 자동 제외

## 들어있는 것

겉으로는 스킬 몇 개처럼 보이지만, 실제로는 실전 운영용 세팅에 가깝습니다.

### 리서치 스택

- **Context7**: 공식 문서 확인
- **Jina**: 웹페이지 본문 읽기, WebFetch 대체
- **Sequential Thinking**: 구조적으로 생각하게 강제

### 리뷰 스택

- **glm-review**: `/rr`, `/rrr` 코드리뷰
- **Claude 재검증 루프**: 다른 모델의 리뷰를 그대로 믿지 않고 한 번 더 확인

### 토큰 절약 스택

- **rtk-rewrite.js**: `git log`, `ls`, `tsc`, `eslint`, `playwright` 같은 noisy command를 `rtk`로 자동 리라이트

### 운영 hooks

- **bash-guard.js**: 위험 명령 차단
- **audit-log.js**: Bash 사용 로그 기록
- **block-webfetch.js**: WebFetch 차단 후 Jina로 유도
- **handoff-load.js**: `handoff.md`, `STATE.md` 자동 로드
- **add-date.js**: 현재 날짜 자동 주입
- **postwrite-check.js**: TS 파일 수정 후 타입체크 권장
- **compact-reinject.js**: 팀 작업 중 compact 후 컨텍스트 재주입
- **telegram-notify.js**: idle/permission 상태 Telegram 알림

## 설치기가 실제로 하는 일

`npx dgk-claude`는 아래를 자동으로 처리합니다.

- `~/.claude`에 스킬 5개 + hooks 9개 설치
- 기존 `settings.json` 유지
- `dgk-claude` hooks만 병합
- 기존 동일 스킬/훅이 있으면 최신 버전과 다를 때만 업데이트
- 바꾸기 전에 백업
- shell hook를 Node hook로 마이그레이션

즉, 그냥 덮어쓰는 설치기가 아닙니다.  
기존 셋업이 있는 사용자도 비교적 안전하게 붙일 수 있게 만든 설치기입니다.

옵션:

```bash
npx dgk-claude --dry-run
npx dgk-claude --check-ret
npx dgk-claude --check-ret --install-system-deps
npx dgk-claude --yes
npx dgk-claude --skip-glm-review
```

환경 메모:
- macOS, Linux, WSL, Windows에서 같은 설치기로 동작합니다.
- 다만 Claude Code 자체는 공식 문서 기준 Windows에서 Git Bash 환경을 전제로 합니다.
- `handoff-load`는 `handoff.md`뿐 아니라 `STATE.md`도 읽습니다.

## 다른 방식으로 설치하기

### git clone

```bash
git clone https://github.com/dgk-dev/dgk-claude.git
cd dgk-claude
./install.sh
```

### curl

```bash
curl -fsSL https://raw.githubusercontent.com/dgk-dev/dgk-claude/main/install-remote.sh | bash
```

`curl` 경로도 내부적으로 Node 설치기를 호출합니다.

### 필요한 것만 선택 설치

```bash
git clone https://github.com/dgk-dev/dgk-claude.git
cd dgk-claude

cp -r skills/re ~/.claude/skills/re
cp -r skills/cp ~/.claude/skills/cp

cp hooks/bash-guard.js ~/.claude/hooks/
cp hooks/handoff-load.js ~/.claude/hooks/
```

선택 설치 시 `~/.claude/settings.json`의 hooks 등록은 직접 해야 합니다.

## MCP 설정

`/re`와 `/ret`는 MCP 3개가 필요합니다.

```bash
claude mcp add context7-mcp -- npx -y @context7/mcp
claude mcp add jina -- npx -y @jina-ai/mcp-server
claude mcp add sequential-thinking -- npx -y @anthropic/sequential-thinking-mcp
```

API 키가 필요한 경우:

```bash
echo "CONTEXT7_API_KEY='your-key'" >> ~/.claude/.env.local
echo "JINA_API_KEY='your-key'" >> ~/.claude/.env.local
echo "ZAI_API_KEY='your-key'" >> ~/.claude/.env.local
```

## 요구사항 요약

| 기능 | Node 18+ | Claude Code | Git | MCP 3개 | Max 플랜 | tmux | glm-review | ZAI_API_KEY |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 설치기 | O | | | | | | | |
| `/cp` | | O | O | | | | | |
| `/re` | | O | O | O | | | | |
| `/ret` | | O | O | O | O | O | | |
| `/ret` 프리플라이트 | | | | 점검 | 수동 확인 | 점검/설치 | | |
| `/rr` | | O | O | | | | O | O |
| `/rrr` | | O | O | | | | O | O |
| hooks | | O | | | | | | |

## 라이선스

[MIT](LICENSE)
