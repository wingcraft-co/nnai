# prompts/few_shots.py
FEW_SHOT_EXAMPLES = [
    # ── 예시 1: 저소득 / 동남아 / 디지털 노마드 ──────────────────────
    {
        "role": "user",
        "content": (
            "국적: Korean | 월 수입: 300만원 (약 $2,142 USD) | "
            "이민 목적: 디지털 노마드 / 원격 근무 | "
            "사용 가능 언어: 한국어만 가능 | "
            "목표 체류 기간: 1년 단기 체험\n"
            "위 프로필 기반으로 최적 거주 도시 TOP 3를 추천하세요. "
            "현실적 어려움과 위험 요소를 반드시 포함하세요. "
            "반드시 순수 JSON만 출력하세요."
        ),
    },
    {
        "role": "assistant",
        "content": """{
  "top_cities": [
    {
      "city": "Chiang Mai",
      "city_kr": "치앙마이",
      "country": "Thailand",
      "country_id": "TH",
      "visa_type": "Tourist Visa (Extension)",
      "visa_url": "https://www.thaiembassy.com/thailand-visa/tourist-visa",
      "monthly_cost_usd": 1100,
      "score": 9,
      "reasons": [
        {
          "point": "치앙마이는 디지털 노마드 커뮤니티 규모 기준 전 세계 상위 5개 도시에 꾸준히 선정됩니다.",
          "source_url": "https://nomads.com/cost-of-living"
        },
        {
          "point": "월 $1,100 수준의 생활비로 쾌적한 에어컨 아파트, 코워킹 스페이스, 외식을 충당할 수 있습니다.",
          "source_url": null
        },
        {
          "point": "님만해민 일대에 한국 음식점과 한인 커뮤니티가 밀집해 한국어만으로도 초기 정착이 가능합니다.",
          "source_url": null
        },
        {
          "point": "코워킹 스페이스 월 이용료가 $60~100 수준으로 포르투갈·에스토니아 대비 5분의 1 수준입니다.",
          "source_url": null
        }
      ],
      "realistic_warnings": [
        "태국 관광비자는 연속 갱신에 제한이 있으며, 당국의 재량에 따라 입국 거절 사례가 보고됩니다. 장기 체류를 위한 합법적 비자 경로(LTR, Thailand Elite)를 반드시 사전에 검토해야 합니다.",
        "태국에서 원격 근무는 법적으로 취업으로 간주될 수 있어 Work Permit 없이 소득 활동 시 법적 위험이 있습니다. 고용주 국가가 태국 외부인지 확인이 필요합니다."
      ]
    },
    {
      "city": "Kuala Lumpur",
      "city_kr": "쿠알라룸푸르",
      "country": "Malaysia",
      "country_id": "MY",
      "visa_type": "DE Nomad Visa",
      "visa_url": "https://www.digitalnomad.gov.my",
      "monthly_cost_usd": 1500,
      "score": 8,
      "reasons": [
        {
          "point": "말레이시아 DE Nomad Visa는 월 $2,400 소득 기준이며, 현 수입($2,142)이 기준에 근접합니다. 소득 증빙 방식에 따라 충족 가능성을 사전 확인하세요.",
          "source_url": "https://www.digitalnomad.gov.my"
        },
        {
          "point": "영어·중국어·말레이어가 통용되며, 한인 타운(암팡, 몽키아라)에서 한국어만으로도 기본 생활이 가능합니다.",
          "source_url": null
        },
        {
          "point": "인터넷 인프라가 동남아 최상급 수준으로, 평균 다운로드 속도 100Mbps 이상입니다.",
          "source_url": null
        }
      ],
      "realistic_warnings": [
        "DE Nomad Visa의 소득 기준($2,400/월)이 현 수입과 근소한 차이이므로, 신청 전 3개월 이상의 소득 증빙 서류를 충분히 준비해야 합니다.",
        "쿠알라룸푸르는 대중교통 인프라가 불완전하여 차량 없이는 이동이 불편한 지역이 많습니다. 거주지 선정 시 LRT·MRT 노선 접근성을 반드시 확인하세요."
      ]
    },
    {
      "city": "Ho Chi Minh City",
      "city_kr": "호치민",
      "country": "Vietnam",
      "country_id": "VN",
      "visa_type": "E-Visa (90일)",
      "visa_url": "https://evisa.xuatnhapcanh.gov.vn",
      "monthly_cost_usd": 900,
      "score": 7,
      "reasons": [
        {
          "point": "월 $900 수준으로 동남아 주요 도시 중 최저 생활비를 제공하며, 한국 음식점이 밀집한 7군(District 7) 한인타운이 조성되어 있습니다.",
          "source_url": null
        },
        {
          "point": "90일 E-Visa 발급이 온라인으로 간편하며, 현재 한국인에 대한 45일 무비자 입국도 가능합니다.",
          "source_url": "https://evisa.xuatnhapcanh.gov.vn"
        }
      ],
      "realistic_warnings": [
        "베트남은 별도의 디지털 노마드 비자가 없어 장기 합법 체류를 위해서는 비자 런(인근 국가 출국 후 재입국)이 필요합니다. 당국의 재량에 따라 거절될 수 있습니다.",
        "대기오염 수준이 높아 호흡기 건강에 민감한 분께는 적합하지 않을 수 있습니다. AQI 지수를 정기적으로 확인하세요."
      ]
    }
  ],
  "overall_warning": "이민 및 장기 체류는 최소 6개월~1년의 준비 기간이 필요한 중대한 결정입니다. 본 추천은 공개 데이터 기반 참고용이며, 비자 정책은 수시로 변경될 수 있으므로 반드시 해당국 공식 이민 기관 또는 공인 이민 전문가와 상담 후 결정하세요."
}""",
    },

    # ── 예시 2: 고소득 / 유럽 / 자녀 교육 이민 ──────────────────────
    {
        "role": "user",
        "content": (
            "국적: Korean | 월 수입: 900만원 (약 $6,426 USD) | "
            "이민 목적: 자녀 교육 이민 | "
            "사용 가능 언어: 영어 (업무 가능 수준) | "
            "목표 체류 기간: 영구 이민 (영주권 목표)\n"
            "위 프로필 기반으로 최적 거주 도시 TOP 3를 추천하세요. "
            "현실적 어려움과 위험 요소를 반드시 포함하세요. "
            "반드시 순수 JSON만 출력하세요."
        ),
    },
    {
        "role": "assistant",
        "content": """{
  "top_cities": [
    {
      "city": "Lisbon",
      "city_kr": "리스본",
      "country": "Portugal",
      "country_id": "PT",
      "visa_type": "D8 Digital Nomad Visa",
      "visa_url": "https://vistos.mne.gov.pt/en/national-visas/general-information/type-of-visa",
      "monthly_cost_usd": 2600,
      "score": 9,
      "reasons": [
        {
          "point": "포르투갈 D8 비자 취득 후 5년 거주 시 영주권, 6년 후 시민권 신청이 가능하여 자녀 교육 이민의 장기 경로로 적합합니다.",
          "source_url": "https://vistos.mne.gov.pt"
        },
        {
          "point": "포르투갈 공립학교는 외국인 자녀에게도 무상 제공되며, 국제학교 대비 수준 높은 유럽 교육 커리큘럼을 받을 수 있습니다.",
          "source_url": null
        },
        {
          "point": "NHR(비정기 거주자) 세제 혜택을 신청하면 최초 10년간 외국 소득에 20% 단일세율이 적용되어 세금 부담이 크게 감소합니다.",
          "source_url": "https://info.portaldasfinancas.gov.pt"
        }
      ],
      "realistic_warnings": [
        "포르투갈 D8 비자 처리 기간이 최소 3~6개월 소요되며, 리스본 영사관 적체로 실제 1년 이상 걸리는 사례가 빈번합니다. 이민 일정을 최소 1년 이상 앞서 준비해야 합니다.",
        "리스본 부동산 가격이 2020년 대비 50% 이상 상승했으며, 월세 €1,500~2,500 수준의 3베드룸 아파트 확보가 어렵습니다. 사전 현지 방문 없이 온라인 계약을 체결하는 것은 권장하지 않습니다."
      ]
    },
    {
      "city": "Tallinn",
      "city_kr": "탈린",
      "country": "Estonia",
      "country_id": "EE",
      "visa_type": "Digital Nomad Visa",
      "visa_url": "https://www.politsei.ee/en/instructions/digital-nomad-visa",
      "monthly_cost_usd": 2200,
      "score": 8,
      "reasons": [
        {
          "point": "에스토니아는 PISA 교육 평가에서 유럽 최상위권을 기록하며, 특히 수학·과학 교육이 세계적 수준입니다.",
          "source_url": "https://www.oecd.org/pisa/"
        },
        {
          "point": "디지털 인프라가 EU 최상급으로, 전자정부 서비스 및 고속 인터넷 환경이 원격 근무에 최적화되어 있습니다.",
          "source_url": null
        },
        {
          "point": "e-Residency를 함께 취득하면 EU 기반 법인 설립이 가능하여 소득 구조를 최적화할 수 있습니다.",
          "source_url": "https://www.e-resident.gov.ee"
        }
      ],
      "realistic_warnings": [
        "에스토니아어를 구사하지 못하면 취업 시장 진입이 제한됩니다. 자녀의 경우 학교 적응을 위해 에스토니아어 또는 영어 집중 교육 기간이 필요합니다.",
        "겨울철(11~2월) 일조 시간이 하루 6시간 미만으로 극히 짧아, 우울증 등 정서적 어려움을 경험하는 이민자 사례가 보고됩니다. 사전 현지 적응 방문을 권장합니다."
      ]
    },
    {
      "city": "Barcelona",
      "city_kr": "바르셀로나",
      "country": "Spain",
      "country_id": "ES",
      "visa_type": "Startup Law Digital Nomad Visa",
      "visa_url": "https://www.exteriores.gob.es/en/EmbajadasConsulados/pages/inicio.aspx",
      "monthly_cost_usd": 2900,
      "score": 8,
      "reasons": [
        {
          "point": "스페인은 자녀 영주권자에게 무상 공립 교육을 제공하며, 바르셀로나의 국제학교 네트워크도 광범위합니다.",
          "source_url": null
        },
        {
          "point": "스타트업 법(Ley de Startups)에 따른 디지털 노마드 비자 취득자는 최초 4년간 외국 소득에 24% 단일세율(일반 세율 47% 대비 대폭 감소)이 적용됩니다.",
          "source_url": "https://www.exteriores.gob.es"
        },
        {
          "point": "지중해 기후와 풍부한 문화 인프라, 유럽 주요 도시 접근성이 가족 이민지로서 높은 삶의 질을 제공합니다.",
          "source_url": null
        }
      ],
      "realistic_warnings": [
        "바르셀로나 집값 및 월세가 유럽 5위권 수준으로 상승해 있으며, 한국 가족이 선호하는 구역(에이샴플레, 그라시아)의 3베드룸 월세는 €2,500~4,000 수준입니다.",
        "스페인어 또는 카탈루냐어를 구사하지 못하면 자녀의 공립학교 편입 및 일상 행정 처리에 상당한 어려움이 따릅니다. 이민 전 최소 6개월의 언어 교육이 권장됩니다."
      ]
    }
  ],
  "overall_warning": "자녀 교육 이민은 자녀의 학령 주기와 비자 처리 일정을 동기화해야 하므로, 이상적으로는 이민 목표 시점 2년 전부터 준비를 시작해야 합니다. 본 추천은 공개 데이터 기반 참고용이며, 반드시 공인 이민 전문가 및 해당국 대사관에서 최신 비자 정책을 확인하세요."
}""",
    },
]
