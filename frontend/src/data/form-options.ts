export interface SelectOption {
  label: string;
  value: string;
}

export const NATIONALITY_OPTIONS: SelectOption[] = [
  { label: "한국", value: "Korean" },
  { label: "일본", value: "Japanese" },
  { label: "미국", value: "American" },
  { label: "기타", value: "Other" },
];

export const LANGUAGE_OPTIONS: SelectOption[] = [
  { label: "영어 원어민", value: "영어 원어민" },
  { label: "영어 업무 수준", value: "영어 업무 수준" },
  { label: "영어 기초", value: "영어 기초" },
  { label: "스페인어", value: "스페인어" },
  { label: "포르투갈어", value: "포르투갈어" },
  { label: "일본어", value: "일본어" },
];

export const PURPOSE_OPTIONS: SelectOption[] = [
  { label: "원격 근무", value: "원격 근무" },
  { label: "프리랜서 활동", value: "프리랜서 활동" },
  { label: "창업 준비", value: "창업 준비" },
  { label: "장기 여행", value: "장기 여행" },
  { label: "은퇴 후 거주", value: "은퇴 후 거주" },
];

export const TIMELINE_OPTIONS: SelectOption[] = [
  { label: "1~3개월 단기 체험", value: "1~3개월 단기 체험" },
  { label: "6개월 중기 체류", value: "6개월 중기 체류" },
  { label: "1년 장기 체류", value: "1년 장기 체류" },
  { label: "영주권/이민 목표", value: "영주권/이민 목표" },
];

export const LIFESTYLE_OPTIONS: SelectOption[] = [
  { label: "해변", value: "해변" },
  { label: "산/자연", value: "산/자연" },
  { label: "도시", value: "도시" },
  { label: "카페 문화", value: "카페 문화" },
  { label: "영어권", value: "영어권" },
  { label: "코워킹 스페이스", value: "코워킹 스페이스" },
  { label: "저물가", value: "저물가" },
  { label: "안전", value: "안전" },
];

export const TRAVEL_TYPE_OPTIONS: SelectOption[] = [
  { label: "혼자 (솔로)", value: "혼자 (솔로)" },
  { label: "배우자/파트너 동반", value: "배우자·파트너 동반" },
  { label: "자녀 동반 (배우자 없이)", value: "자녀 동반 (배우자 없이)" },
  { label: "가족 전체 동반", value: "가족 전체 동반 (배우자 + 자녀)" },
];

export const INCOME_TYPE_OPTIONS: SelectOption[] = [
  { label: "프리랜서", value: "프리랜서 (계약서·해외 송금 내역)" },
  { label: "해외 법인 재직", value: "해외 법인 재직" },
  { label: "국내 법인 원격근무", value: "국내 법인 원격근무" },
  { label: "무소득 / 은퇴", value: "무소득 / 은퇴" },
];

export const PREFERRED_REGION_OPTIONS: SelectOption[] = [
  { label: "아시아", value: "아시아" },
  { label: "유럽", value: "유럽" },
  { label: "중남미", value: "중남미" },
  { label: "중동/아프리카", value: "중동/아프리카" },
  { label: "북미", value: "북미" },
];

export const READINESS_OPTIONS: SelectOption[] = [
  { label: "아직 정보 수집 중", value: "아직 정보 수집 중" },
  { label: "구체적으로 준비 중", value: "구체적으로 준비 중" },
  { label: "3개월 내 출발 예정", value: "3개월 내 출발 예정" },
  { label: "이미 해외 체류 중", value: "이미 해외 체류 중" },
];

export const SPOUSE_INCOME_OPTIONS: SelectOption[] = [
  { label: "없음", value: "없음" },
  { label: "있음", value: "있음" },
];
