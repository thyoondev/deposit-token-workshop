# 용어와 코드 설명

처음 시작한다면 [수강생 안내](../README.md)를 먼저 따라 해주세요. 이 문서는 실습 중 낯선 용어나 코드의 조건을 찾아볼 때 사용합니다.

## 용어 먼저 보기

| 용어 | 이 실습에서의 의미 |
|---|---|
| 컨트랙트 | 토큰의 잔액과 거래 규칙을 실행하는 프로그램 |
| KYCRegistry | 주소별 거래 승인 여부를 저장하는 프로그램 |
| Mint / Burn | 토큰 발행 / 소각. 수량을 늘리거나 줄이는 동작 |
| approve / allowance | 다른 계정에 사용 권한 부여 / 남은 허용 수량 |
| transfer / transferFrom | 직접 전송 / 고객 대신 실행하는 전송 |
| Pause / Freeze | 전체 잔액 변경 중단 / 특정 계정 제한 |
| 역할(Role) | 발행·소각·중단 등 관리 기능을 실행할 권한 |
| Proxy / UUPS | 사용하는 주소와 데이터를 유지하며 내부 코드를 교체하는 구조 / 이번 예제의 업그레이드 방식 |
| 테스트 | 준비한 상황에서 코드가 예상대로 동작하는지 자동 확인 |
| Coverage | 테스트가 실행한 코드의 범위 |

실제 고객 정보나 자산은 사용하지 않습니다. 발행·소각은 은행 계좌의 입출금을 수행하지 않습니다.

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

## 계정과 수량

`admin`은 초기 관리자, `bank`는 발행·소각 담당자, `compliance`는 중단·동결 담당자입니다. `alice`와 `bob`은 고객, `spender`는 고객 대신 전송하는 계정, `outsider`는 권한이 없는 상황을 확인할 때 쓰는 계정입니다. 모두 테스트가 준비하는 연습용 계정입니다.

표시 수량 100과 코드의 정수 100은 다릅니다. 이 토큰은 소수 18자리를 사용하므로 예제의 `u("100")`은 `ethers.parseUnits("100", 18)`로 변환합니다. 화면 출력은 사람이 읽을 수 있는 수량으로 다시 바꿉니다.

## 오류 이름 읽기

| 오류 | 확인할 내용 |
|---|---|
| `AccessControlUnauthorizedAccount` | 실행 계정에 필요한 관리 권한이 있는지 |
| `KYCRequired` | 오류에 표시된 주소의 거래 자격이 승인됐는지 |
| `ERC20InsufficientAllowance` | 고객이 실제 실행자에게 충분한 수량을 승인했는지 |
| `EnforcedPause` | 전체 중단 상태인지 |
| `AccountFrozen` | 검사 대상 계정이 동결됐는지 |
| `InvalidInitialization` | 이미 초기화한 프록시 또는 초기화를 잠근 구현 주소를 호출했는지 |

거래가 거절됐을 때는 어느 계정이 실행했는지부터 확인합니다. 거절을 예상한 테스트가 통과했다면 해당 오류는 의도한 결과입니다.

## 공식 참고자료

- [Hardhat Mocha·Ethers 테스트](https://hardhat.org/docs/guides/testing/using-ethers)
- [Hardhat Coverage](https://hardhat.org/docs/guides/testing/code-coverage)
- [OpenZeppelin 업그레이드 작성 규칙](https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable)
- [OpenZeppelin Hardhat Upgrades](https://docs.openzeppelin.com/upgrades-plugins/hardhat-upgrades)
- [OpenZeppelin ERC-20 API](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20)
