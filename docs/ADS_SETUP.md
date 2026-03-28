# Google AdSense 설정 가이드

## 1. Google AdSense 계정 준비

1. [Google AdSense](https://www.google.com/adsense) 계정 생성
2. nnai.app 사이트 등록 및 승인 대기
3. 승인 후 **광고 단위 생성** (세로형, 300×600 권장)

## 2. data/ads_config.json 업데이트

```json
{
  "google_adsense": {
    "publisher_id": "ca-pub-YOUR_PUBLISHER_ID",
    "ad_slot_vertical": "YOUR_AD_SLOT_ID"
  },
  "enabled": true,
  "width_px": 300,
  "height_px": 600
}
```

- `publisher_id`: AdSense 계정 → 계정 정보 → 게시자 ID (ca-pub-... 형식)
- `ad_slot_vertical`: 광고 단위 생성 후 얻는 슬롯 ID

## 3. 광고 비활성화

`"enabled": false` 로 설정하면 광고 영역이 사라집니다.

## 4. 동작 방식

- **데스크톱 (1024px 이상)**: 우측 사이드바에 300px 광고 노출
- **모바일 (1023px 이하)**: 사이드바 완전 숨김, 전체 폭 사용
- Publisher ID에 `xxxxxxxx`가 포함되어 있으면 "광고 영역" 플레이스홀더 표시

## 5. Railway 배포 시

`data/ads_config.json` 파일을 git에 커밋하면 Railway에 자동 반영됩니다.
(publisher ID는 민감 정보가 아니므로 커밋 가능)
