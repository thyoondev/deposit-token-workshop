# 예금토큰 기능 구현 실습

2026 KISA 예금토큰 강의의 실습 코드와 가이드입니다. KYCRegistry와 업그레이드 가능한 DepositToken을 구현하고 발행·소각, 전송 통제, Pause·Freeze, 단위 테스트를 실습합니다.

로컬 교육용 완성 예제입니다. 실제 고객 정보·자산을 사용하지 않으며, Mint·Burn은 은행 계좌의 입출금을 수행하지 않습니다.

## 빠른 시작

Node.js 24.19.0에서 검증했습니다. `nvm`을 사용한다면 저장소에서 `nvm install`과 `nvm use`로 `.nvmrc`의 버전을 선택할 수 있습니다. 의존성·Solidity 컴파일러를 처음 설치할 때 인터넷 연결이 필요합니다.

```bash
git clone https://github.com/thyoondev/deposit-token-workshop.git
cd deposit-token-workshop/lab
npm ci
npm run build
npm run demo
npm test
npm run coverage
```

명령은 위 순서로 하나씩 실행합니다. 컴파일러를 내려받는 중에 여러 Hardhat 명령을 동시에 실행하지 않습니다.

데모의 기대 결과는 다음과 같습니다.

```text
After mint: 100.0
After burn: 80.0
Supply: 80.0
```

완성 예제의 테스트는 33개입니다. Coverage 보고서는 `lab/coverage/html/index.html`에 생성됩니다. Coverage의 Lines·Statements 수치는 실행 범위이며 모든 정책·입력 조합이나 실제 운영 안전성을 보증하지 않습니다.

## 실습 순서

| 시간 | 내용 | 완료 확인 |
|---|---|---|
| 13:30~15:00 | KYCRegistry·DepositToken·Mint/Burn | 고객 등록, 100 발행, 20 소각 |
| 15:00~16:30 | `_update()`·Pause·Freeze | 정상·거절·해제 후 복구 |
| 16:30~18:00 | Hardhat 단위 테스트·Coverage | 상태·이벤트·실패 시 보존·업그레이드 검증 |

오전 개념·아키텍처를 포함한 전체 시간표는 [강의 진행안](lab/강의진행안.md)에 있습니다.

## 자료

- [실습 가이드](lab/실습가이드.md): 단계별 구현 항목과 실행 명령
- [실습 프로젝트 안내](lab/README.md): 고정 버전·기능별 정책·기대 결과
- [강사용 확인문제 해설](강사용_확인문제_해설.md): 개념·설계·구현·테스트 질문의 답
- [검증 결과](lab/검증결과.md): 실행 환경과 검증 범위
- [참고문헌](참고문헌.md): 강의에서 사용한 공식 자료

## 코드 구성

```text
lab/
├── contracts/
│   ├── KYCRegistry.sol
│   ├── DepositToken.sol
│   └── DepositTokenV2.sol
├── test/DepositToken.ts
├── scripts/demo.ts
├── hardhat.config.ts
├── package.json
└── package-lock.json
```

`package-lock.json`과 `npm ci`를 사용해 의존성을 고정합니다. Hardhat 3.18.1, OpenZeppelin Contracts 5.6.1, Upgrades 4.1.0, Solidity 0.8.28을 사용합니다. Hardhat 2용 설정이나 Coverage 명령을 혼용하지 않습니다.

이 저장소의 테스트와 데모는 로컬 네트워크에서 실행하므로 지갑 개인키·RPC 키·실제 토큰이 필요하지 않습니다. 발표 PPT와 발표 대본은 별도 강의 자료입니다.
