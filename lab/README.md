# 예금토큰 기능 구현 실습

이 프로젝트는 발표자료의 13:30~18:00 실습에 사용하는 완성 예제다. 실제 고객 정보와 자산을 사용하지 않으며, Mint와 Burn으로 은행 계좌를 입출금하지 않는다. 직접 작성할 항목은 [실습 가이드](실습가이드.md)에 정리했다.

## 시작

Node.js 22.13.0 이상을 사용한다. 제공 예제는 Node.js 24.19.0에서 실행했다. 의존성과 컴파일러를 내려받을 수 있는 네트워크에서 준비한다.

```bash
cd lab
npm ci
npm run build
npm run demo
npm test
npm run coverage
```

컴파일러 다운로드가 진행될 때 Hardhat 명령을 여러 개 동시에 실행하지 않는다. 설치 후에도 컴파일러 목록 확인을 위해 네트워크가 필요할 수 있다. 컴파일 결과가 존재하면 `npx hardhat run --no-compile scripts/demo.ts`로 데모를 실행할 수 있다.

## 고정 버전

| 구성 | 버전 |
|---|---|
| Hardhat | 3.18.1 |
| Mocha Ethers toolbox | 4.0.0 |
| OpenZeppelin Contracts / Contracts Upgradeable | 5.6.1 |
| OpenZeppelin Hardhat Upgrades | 4.1.0 |
| Solidity | 0.8.28 |

`package-lock.json`을 유지하고 `npm ci`를 사용한다. Hardhat 2의 설정·플러그인·Coverage 명령을 혼용하지 않는다. Hardhat 3에서는 `hre.network.create()`로 네트워크 연결을 만들고 같은 연결로 ethers와 Upgrades API를 사용한다.

## 파일

- `contracts/KYCRegistry.sol`은 주소별 승인 상태와 KYC 관리자의 권한을 관리한다.
- `contracts/DepositToken.sol`은 ERC-20 잔액, 역할, KYC 검사, Pause, Freeze 및 UUPS 업그레이드를 구현한다.
- `contracts/DepositTokenV2.sol`은 상태 보존 실습용 `version()`을 추가한다.
- `test/DepositToken.ts`는 33개 테스트로 초기화, 정상 거래, 거절, 복구, 업그레이드를 검증한다.
- `scripts/demo.ts`는 100 발행과 20 소각의 결과를 출력한다.

## 실습 정책

| 경로 | 적용 조건 |
|---|---|
| Mint | MINTER_ROLE, 수량 양수, 수신자 KYC, 수신자 비동결, 비중단 상태를 요구한다. |
| Burn | BURNER_ROLE, 수량 양수, 고객 allowance, 보유자 KYC·비동결, 잔액, 비중단 상태를 요구한다. |
| Transfer | 송신자·수신자·호출자의 KYC·비동결과 비중단 상태를 요구한다. |
| TransferFrom | Transfer 조건에 소유자의 allowance를 추가한다. |
| Approve | Pause 또는 Freeze 상태에서도 허용량을 설정할 수 있다. 이동은 별도 검사한다. |
| Upgrade | UPGRADER_ROLE을 요구하며 사전 저장소 검증 후 실행한다. |

영 주소는 Mint와 Burn의 경로 표지이므로 KYC 조회에서 제외한다. 발행·소각 담당자는 역할로 통제하며 일반 고객과 동일한 KYC 조건을 무조건 적용하지 않는다. registry의 코드 존재 여부 검사는 임의의 주소가 올바른 KYC 서비스라는 보증이 아니다. 운영 배포에서는 레지스트리의 코드·권한·주소 검증이 추가로 필요하다.

## 기대 결과

```text
After mint: 100.0
After burn: 80.0
Supply: 80.0

33 passing
```

2026년 10월 3일 제공 코드 실행 결과, 자체 컨트랙트 세 파일의 Lines와 Statements가 각각 100%였다. 이 Hardhat 버전의 요약은 분기율이나 함수율을 표시하지 않는다. 100%는 행·문장을 실행했다는 뜻이며 모든 정책·입력 조합·라이브러리 내부를 검증했다는 뜻은 아니다.

보고서는 `coverage/html/index.html`, LCOV 데이터는 `coverage/lcov.info`에 생성된다. 보고서와 테스트 조건표를 함께 확인한다.

## 공식 참고자료

- [Hardhat Mocha·Ethers 테스트](https://hardhat.org/docs/guides/testing/using-ethers)
- [Hardhat Coverage](https://hardhat.org/docs/guides/testing/code-coverage)
- [OpenZeppelin 업그레이드 작성 규칙](https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable)
- [OpenZeppelin Hardhat Upgrades](https://docs.openzeppelin.com/upgrades-plugins/hardhat-upgrades)
- [OpenZeppelin ERC-20 API](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20)
