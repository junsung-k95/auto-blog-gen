# 3단계. 기능 요구사항 정의

> 기능 간 연결성·데이터 흐름·데이터 모델·외부 통합을 정의.
> 1단계(시나리오)·2단계(기능 목록)를 구현 가능한 명세로 옮기는 단계.

---

## 3.1 도메인 개요

이 서비스가 다루는 **핵심 객체(엔티티)** 8가지:

| 엔티티 | 무엇인가 |
|---|---|
| **User** | 서비스 사용자 |
| **BlogProfile** | 사용자가 운영하는 네이버 블로그(여러 개 가능) |
| **Keyword** | 발굴된/추적 중인 키워드 |
| **KeywordSnapshot** | 키워드의 시점별 지표(검색량·경쟁·CPC) |
| **Post** | 작성·발행되는 글 (Draft → Scheduled → Published) |
| **AffiliateLink** | 글에 삽입된 제휴 링크 |
| **PostMetric** | 글의 일별 성과(방문자·노출·수익) |
| **RevenueRecord** | 채널별 수익 원장 (애드포스트/쿠팡/협찬) |

---

## 3.2 기능 간 연결성 (데이터 흐름)

```
       ┌─────────────────────────────────────────────────────────────┐
       │                       LEARNING LOOP                          │
       │  잘 된 글 패턴 → 추천 가중치 → 다음 키워드 추천 정확도 ↑       │
       └─────────────────────────────────────────────────────────────┘
                ▲                                              │
                │                                              ▼
   ┌────────────────────┐    선택     ┌────────────────────┐
   │  Phase 1: 발굴      │ ──────────► │ Phase 2: 작성       │
   │  Keyword 카드 리스트 │             │  키워드 컨텍스트 주입  │
   │  + 수익성 점수       │             │  + 쿠팡 상품 매칭     │
   └────────────────────┘             └────────────────────┘
                                                 │
                                                 ▼
                                       ┌────────────────────┐
                                       │ Phase 3: 검수       │
                                       │  SEO 점수 / 저품질 경고│
                                       └────────────────────┘
                                                 │
                                                 ▼
   ┌────────────────────┐  매칭(linkId) ┌────────────────────┐
   │ Phase 6: 수익관리    │ ◄──────────│ Phase 4: 발행/예약   │
   │ AffiliateLink 대시보드│             │  postId 채번         │
   └────────────────────┘             └────────────────────┘
                ▲                                 │
                │  매일 동기화                      ▼
                │                       ┌────────────────────┐
                └───────────────────────│ Phase 5: 성과추적   │
                                        │  PostMetric 일별 적재 │
                                        └────────────────────┘
```

### 핵심 연결 규칙

1. **Keyword → Post (M:N)**: 글 하나는 여러 키워드를 타겟할 수 있고, 키워드 하나는 여러 글에 쓰일 수 있다.
2. **Post → AffiliateLink (1:N)**: 글마다 여러 제휴 링크. 링크의 `shortId`가 클릭·전환 매칭 키.
3. **Post → PostMetric (1:N, 일별)**: `(postId, date)` 가 유니크. 시계열 누적.
4. **AffiliateLink → RevenueRecord**: 쿠팡 리포트의 `subId/shortId` 매칭으로 글 단위 수익 산정.
5. **Post → KeywordSnapshot (역참조)**: 글의 타겟 키워드 노출 순위 추적은 발행 시점 스냅샷을 기준으로 비교.

---

## 3.3 데이터 모델 (ERD)

### 3.3.1 핵심 테이블

```
User ──< BlogProfile ──< Post ──< AffiliateLink ──< RevenueRecord
  │                       │
  │                       └──< PostMetric (daily)
  │                       │
  │                       └──>── Keyword (M:N via PostKeyword)
  │
  └──< KeywordBookmark ──> Keyword ──< KeywordSnapshot (daily)
```

### 3.3.2 스키마 정의

#### `users`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | UUID | PK |
| email | TEXT | UNIQUE |
| password_hash | TEXT | bcrypt |
| created_at | TIMESTAMPTZ | |

#### `blog_profiles`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users |
| label | TEXT | "메인 블로그" 같은 이름 |
| naver_username | TEXT | 암호화 저장 |
| naver_api_password_enc | TEXT | AES-256 암호화 |
| naver_blog_id | TEXT | |
| categories | TEXT[] | 운영 카테고리 |
| target_keywords | TEXT[] | 주력 키워드 |
| weekly_goal | INT | 주 발행 목표 |
| golden_hours | INT[] | 발행 선호 시간 (e.g. [7, 21]) |
| created_at | TIMESTAMPTZ | |

#### `style_cards`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | UUID | PK |
| blog_profile_id | UUID | FK |
| tone | TEXT | "친근체"/"정보체" |
| avg_length | INT | 평균 글자 수 |
| emoji_density | FLOAT | 100자당 이모지 수 |
| ending_patterns | JSONB | 자주 쓰는 어미 |
| sample_text | TEXT | 학습된 샘플(요약) |

#### `revenue_channels`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK |
| kind | TEXT | 'adpost' / 'coupang' / 'sponsor' / 'aliexpress' |
| credentials_enc | JSONB | 채널별 API 키·파트너ID 암호화 |
| active | BOOL | |

#### `keywords`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | UUID | PK |
| term | TEXT | 키워드 문자열 |
| category | TEXT | 추정 카테고리 |
| first_seen_at | TIMESTAMPTZ | |
| UNIQUE | (term) | |

#### `keyword_snapshots` (일별 시계열)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGSERIAL | PK |
| keyword_id | UUID | FK |
| captured_at | DATE | |
| blog_volume | INT | 네이버 블로그 검색 결과 수 |
| cafe_volume | INT | 카페 검색 결과 수 |
| monthly_search | INT | 데이터랩 추정 검색량 |
| competition_ratio | FLOAT | blog_volume / monthly_search |
| trend_4w | FLOAT[] | 최근 4주 데이터랩 지수 |
| est_cpc | INT | 추정 CPC (KRW) |
| coupang_match_count | INT | 매칭되는 쿠팡 상품 수 |
| score_total | FLOAT | 황금 점수 (계산식 3.5 참조) |
| UNIQUE | (keyword_id, captured_at) | |

#### `keyword_bookmarks`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| user_id | UUID | FK |
| keyword_id | UUID | FK |
| state | TEXT | 'saved' / 'ignored' |
| PRIMARY KEY | (user_id, keyword_id) | |

#### `posts`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | UUID | PK |
| blog_profile_id | UUID | FK |
| status | TEXT | 'draft' / 'review' / 'scheduled' / 'publishing' / 'published' / 'failed' |
| title | TEXT | |
| content_html | TEXT | |
| tags | TEXT[] | |
| category | TEXT | |
| scheduled_at | TIMESTAMPTZ | 예약 발행 시각 |
| published_at | TIMESTAMPTZ | |
| naver_post_id | TEXT | 발행 후 채워짐 |
| ai_provider | TEXT | 'openai' / 'claude' |
| token_cost_usd | NUMERIC(10,4) | 생성 비용 |
| seo_score | INT | 0~100 |
| risk_flags | TEXT[] | 저품질 위험 플래그 |
| disclosure_kind | TEXT | 'none' / 'self_purchase' / 'sponsored' |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `post_keywords` (M:N)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| post_id | UUID | FK |
| keyword_id | UUID | FK |
| role | TEXT | 'primary' / 'secondary' / 'tag' |
| rank_at_publish | INT | 발행 시점 검색 순위 (없으면 NULL) |
| PRIMARY KEY | (post_id, keyword_id) | |

#### `affiliate_links`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | UUID | PK |
| post_id | UUID | FK |
| channel | TEXT | 'coupang' / 'aliexpress' / 'custom' |
| short_id | TEXT | 단축링크 ID (수익 매칭 키) |
| target_url | TEXT | 원본 URL |
| product_name | TEXT | |
| product_price | INT | |
| inserted_at | TIMESTAMPTZ | |
| UNIQUE | (short_id) | |

#### `post_metrics` (일별)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| post_id | UUID | FK |
| date | DATE | |
| visitors | INT | |
| views | INT | |
| avg_dwell_sec | INT | |
| inbound_keywords | JSONB | `[{kw, count}]` |
| likes | INT | |
| comments | INT | |
| top_rank | INT | 그날 타겟 키워드 최고 순위 |
| PRIMARY KEY | (post_id, date) | |

#### `revenue_records` (일별 × 채널)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGSERIAL | PK |
| user_id | UUID | FK |
| post_id | UUID | FK, NULL 가능 (애드포스트 안분 전) |
| channel | TEXT | 'adpost' / 'coupang' / 'sponsor' |
| date | DATE | |
| clicks | INT | |
| conversions | INT | |
| amount_krw | INT | |
| raw_payload | JSONB | 원본 응답 디버그용 |
| INDEX | (user_id, date) | |

#### `jobs` (백그라운드 큐)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | UUID | PK |
| kind | TEXT | 'publish' / 'scrape_metrics' / 'sync_revenue' / 'refresh_keywords' |
| run_at | TIMESTAMPTZ | |
| status | TEXT | 'queued' / 'running' / 'done' / 'failed' |
| payload | JSONB | |
| attempts | INT | |
| last_error | TEXT | |

---

## 3.4 상태 전이 (State Machine)

### Post 상태

```
   ┌──────┐  AI 생성 완료    ┌─────────┐  검수 통과    ┌────────────┐
   │ draft│ ───────────────► │  review │ ───────────► │  scheduled  │
   └──────┘                  └─────────┘              └────────────┘
       ▲                          │                        │
       │                          │ 즉시 발행 클릭            │ 예약 시각 도달
       │                          └──────────────┐         │
       │                                         ▼         ▼
       │                                  ┌──────────────────┐
       └──────────── 재편집 ──────────────│   publishing      │
                                          └──────────────────┘
                                                 │
                              ┌──────────────────┼───────────────────┐
                              ▼                                       ▼
                       ┌────────────┐                          ┌────────────┐
                       │ published  │                          │   failed   │
                       └────────────┘                          └────────────┘
                                                                     │
                                                                     ▼
                                                              (재시도 큐 진입)
```

### Sponsor (협찬) 상태 — Phase 6.4 칸반

```
proposed → accepted → drafting → published → invoiced → paid
                  └──> declined
```

---

## 3.5 핵심 알고리즘 명세

### 3.5.1 황금 키워드 스코어 (Phase 1.1)

```
golden_score(kw) =
    w1 * normalize(monthly_search)       # 검색량 — 높을수록 +
  - w2 * normalize(competition_ratio)    # 경쟁 — 높을수록 −
  + w3 * normalize(trend_growth_4w)      # 4주 증가율 — 높을수록 +
  + w4 * normalize(est_cpc)              # 단가 — 높을수록 +
  + w5 * has_coupang_match * 0.5         # 제휴 가능 보너스
  + w6 * user_category_match * 0.3       # 운영 카테고리 일치 보너스
```

기본 가중치: `w1=0.30, w2=0.25, w3=0.20, w4=0.15, w5=0.07, w6=0.03`
(Phase 7 학습 루프에서 사용자별 보정)

### 3.5.2 SEO 점수 (Phase 3.1) — 100점 만점

| 항목 | 배점 | 합격 기준 |
|---|---|---|
| 제목에 주 키워드 포함 | 20 | 포함 시 만점 |
| 제목 길이 25~45자 | 10 | 범위 내 만점 |
| 본문 글자수 ≥ 1000 | 15 | 1500자 이상 만점 |
| 주 키워드 본문 밀도 1~3% | 15 | 범위 내 만점 |
| H2/H3 구조 (≥3개) | 10 | 3개 이상 만점 |
| 이미지 수 ≥ 3 | 10 | 3장 이상 만점 |
| 이미지 alt 텍스트 | 5 | 모두 채워짐 시 만점 |
| 태그 5~10개 | 10 | 범위 내 만점 |
| 외부 링크 비율 ≤ 10% | 5 | 초과 시 0 |

### 3.5.3 글 단위 수익 안분 (Phase 5.4)

애드포스트는 글 단위 리포트가 없으므로 안분:

```
post_revenue(post, date) =
    daily_total_adpost(date)
  × (post_views(post, date) / sum_views(date))
```

쿠팡은 `short_id` 직접 매칭이라 안분 불필요.

---

## 3.6 외부 통합 (Integration Map)

| 외부 시스템 | 용도 | 호출 시점 |
|---|---|---|
| OpenAI Whisper | 음성→텍스트 | Phase 2 작성 중 (즉시) |
| OpenAI GPT-4o / Anthropic Claude | 본문 생성, 키워드 추출, 제목 최적화 | Phase 1·2·3 |
| 네이버 검색 OpenAPI (blog/cafearticle) | 검색량·경쟁도 | Phase 1 (배치 + 온디맨드) |
| 네이버 데이터랩 검색어 트렌드 | 시계열 트렌드 | Phase 1 (일 1회 배치) |
| 네이버 자동완성/연관검색어 (스크래핑) | 키워드 시드 확장 | Phase 1 (일 1회 배치) |
| 네이버 블로그 XML-RPC (MetaWeblog) | 사진 업로드 / 글 발행 | Phase 4 |
| 네이버 블로그 통계 (스크래핑) | 글별 방문자·노출·유입KW | Phase 5 (1시간 주기) |
| 애드포스트 리포트 (스크래핑/API) | 일별 수익 | Phase 5 (일 1회) |
| 쿠팡파트너스 API | 상품 검색 / 단축링크 / 리포트 | Phase 2 (상품매칭), Phase 5 (성과) |
| Slack / 카카오톡 / 이메일 | 알림 | Phase 4·5 (이벤트 트리거) |

### 인증 정보 보관 원칙

- 모든 외부 자격증명은 **AES-256-GCM** 으로 컬럼 암호화
- 마스터 키는 환경변수 `ENCRYPTION_KEY` (서비스 외부 KMS로 이관 가능 구조)
- 로그·에러 메시지에 자격증명 노출 금지 (PII 스크러버 미들웨어)

---

## 3.7 백그라운드 잡 (Job Queue)

| 잡 종류 | 주기 | 동작 |
|---|---|---|
| `refresh_keywords` | 매일 03:00 | 사용자 카테고리별 키워드 시드 확장 + 스냅샷 생성 |
| `publish` | 스케줄 도달 시 | `posts.scheduled_at` 도달 시 발행 큐 |
| `scrape_metrics` | 매시간 | 발행 7일 이내 글 대상 통계 스크래핑 |
| `sync_revenue` | 매일 04:00 | 애드포스트·쿠팡 일별 수익 동기화 |
| `rank_tracker` | 매일 06:00 | 타겟 키워드 검색 결과에서 내 글 순위 캡처 |
| `rewrite_suggest` | 매주 일요일 | 6개월 지난 호조 글 자동 발견 → 리라이트 큐 |

기본 구현: PostgreSQL 기반 단순 큐 (`SELECT ... FOR UPDATE SKIP LOCKED`).
규모 커지면 BullMQ + Redis.

---

## 3.8 API 엔드포인트 정의

> 모든 요청은 `Authorization: Bearer <jwt>` 필요 (X.1 인증 이후).

### Phase 0 — 셋업

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/auth/signup` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| GET | `/api/blogs` | 내 블로그 프로필 목록 |
| POST | `/api/blogs` | 블로그 프로필 등록 |
| POST | `/api/blogs/:id/import` | 과거 글 임포트 트리거 |
| POST | `/api/channels` | 수익 채널 연결 |
| PATCH | `/api/me/preferences` | 운영 설정 변경 |

### Phase 1 — 발굴

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/keywords/recommend?category=&limit=` | 황금 키워드 카드 리스트 |
| GET | `/api/keywords/:id` | 키워드 상세 + 스냅샷 시계열 |
| POST | `/api/keywords/bookmark` | 저장/무시 토글 |
| GET | `/api/competitors?keyword=` | 상위 글 분석 |

### Phase 2~3 — 작성·검수

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/transcribe` | 음성 → 텍스트 *(현존)* |
| POST | `/api/generate` | 본문 스트리밍 생성 *(현존, 키워드 컨텍스트 파라미터 추가)* |
| POST | `/api/coupang/match` | 본문 → 상품 매칭 |
| POST | `/api/posts` | Draft 저장 |
| GET | `/api/posts/:id/seo-score` | SEO 점수 + 위험 플래그 |
| POST | `/api/posts/:id/optimize` | 제목·태그 최적화 |

### Phase 4 — 발행·예약

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/posts/:id/publish` | 즉시 발행 *(현존, 확장)* |
| POST | `/api/posts/:id/schedule` | 예약 발행 등록 |
| DELETE | `/api/posts/:id/schedule` | 예약 취소 |
| GET | `/api/calendar?from=&to=` | 캘린더 뷰 데이터 |
| GET | `/api/posts?status=draft` | 검수 대기함 |

### Phase 5 — 성과

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/posts/:id/metrics?range=30d` | 글별 일별 메트릭 |
| GET | `/api/dashboard?range=30d` | 통합 대시보드 |
| GET | `/api/rankings?keyword=` | 키워드 순위 추적 |

### Phase 6 — 수익

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/revenue?range=30d&channel=` | 수익 원장 조회 |
| GET | `/api/affiliate-links` | 제휴 링크 대시보드 |
| POST | `/api/products/favorite` | 상품 즐겨찾기 |
| GET | `/api/sponsors` | 협찬 칸반 |
| POST | `/api/sponsors/:id/transition` | 협찬 상태 전이 |

---

## 3.9 비기능 요구사항

| 항목 | 요구 |
|---|---|
| 본문 스트리밍 첫 토큰 지연 | ≤ 2초 (Claude 기준) |
| 키워드 추천 API 응답 | ≤ 1초 (사전 계산 캐시) |
| 동시 발행 처리 | 분당 30건 |
| 자격증명 암호화 | AES-256-GCM, 컬럼 단위 |
| 로그 보존 | 90일 |
| 백업 | 일 1회 DB 스냅샷, 7일 롤링 |
| 가용성 | 발행 잡 큐 99% 성공률 (재시도 3회 포함) |
| 비용 가드레일 | 사용자별 월 AI 토큰 비용 한도 (기본 $20) |

---

## 3.10 보안·컴플라이언스

- 네이버 OpenAPI 호출은 서버측에서만, 클라이언트 노출 금지
- 쿠팡파트너스 의무 고지 문구 자동 삽입 (공정위 추천문안)
- 협찬글은 `disclosure_kind='sponsored'` 강제, 본문 상단·하단에 표기
- 사용자 데이터 삭제 요청 시: posts/metrics/revenue 7일 내 hard delete

---

## 3.11 다음 단계 (4단계 예고)

이 요구사항이 확정되면 4단계에서:

- **화면 정보 구조(IA)** — 메뉴/탭/사이드바 구조
- **주요 화면 와이어프레임** — 대시보드, 키워드 발굴, 작성, 검수, 캘린더, 수익 대시보드
- **상호작용 패턴** — 호버링 액션 버튼(FAB), 슬라이드 패널, 키보드 단축키
- **디자인 토큰** — 색상·타이포·간격 시스템
- **반응형 규칙** — 모바일(이동 중 음성녹음) 우선
