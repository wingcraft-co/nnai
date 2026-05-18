import type { PersonaType } from "@/data/personas";

export type OnboardingLocale = "ko" | "en";

export type OnboardingOption = {
  label: string;
  value: string;
};

export type OnboardingQuizOption = OnboardingOption & {
  persona: PersonaType;
};

export type OnboardingQuizQuestion = {
  id: number;
  question: string;
  options: OnboardingQuizOption[];
};

type PersonaResultContent = {
  label: string;
  description: string[];
  city: string[];
  work: string[];
  value: string[];
  moment: string[];
};

type OnboardingCopy = {
  quiz: {
    questions: OnboardingQuizQuestion[];
  };
  form: {
    preferredLanguage: "한국어" | "English";
    navigation: {
      back: string;
      next: string;
      skip: string;
      submit: string;
      loading: string;
      error: string;
    };
    stepTitles: string[];
    shortStayBudgetTitle: string;
    labels: {
      timeline: string;
      stayStyle: string;
      monthlyBudget: string;
      monthlyIncome: string;
      taxSensitivity: string;
      spouseIncome: string;
      spouseIncomeRange: string;
      childrenAges: string;
      preferredRegion: string;
      lifestyle: string;
      visaAccuracyWarning: string;
    };
    personaBadge: {
      prefix: string;
      suffix: string;
    };
    options: {
      purpose: OnboardingOption[];
      timeline: OnboardingOption[];
      stayStyle: OnboardingOption[];
      budgetRange: OnboardingOption[];
      incomeRange: OnboardingOption[];
      taxSensitivity: OnboardingOption[];
      travelType: OnboardingOption[];
      spouseIncome: OnboardingOption[];
      childrenAge: OnboardingOption[];
      region: OnboardingOption[];
      lifestyle: OnboardingOption[];
    };
  };
  result: {
    headerPrefix: string;
    sections: {
      city: string;
      work: string;
      moment: string;
      value: string;
    };
    actions: {
      findCountry: string;
      retry: string;
    };
    personas: Record<PersonaType, PersonaResultContent>;
  };
};

function normalizeOnboardingLocale(locale: string): OnboardingLocale {
  return locale === "ko" ? "ko" : "en";
}

const sharedOptionValues = {
  purpose: [
    ["원격 근무", "Remote work"],
    ["프리랜서 활동", "Freelancing"],
    ["온라인 비즈니스 운영", "Online business"],
    ["장기 여행", "Long-term travel"],
    ["은퇴 후 거주", "Retirement living"],
  ],
  timeline: [
    ["1~3개월 단기 체류", "1-3 month short stay"],
    ["6개월 중기 체류", "6 month mid-term stay"],
    ["1년 장기 체류", "1 year long stay"],
    ["영주권/이민 목표", "Permanent residency / immigration"],
  ],
  stayStyle: [
    ["정착형", "Stay longer in one city"],
    ["순환형", "Rotate between 2-3 cities"],
    ["이동형", "Move freely across countries"],
  ],
  budgetRange: [
    ["100", "Under 2M KRW"],
    ["300", "2M-4M KRW"],
    ["500", "4M-6M KRW"],
    ["700", "6M-8M KRW"],
    ["900", "Over 8M KRW"],
    ["0", "Prefer not to say"],
  ],
  incomeRange: [
    ["150", "Under 2M KRW"],
    ["250", "2M-3M KRW"],
    ["400", "3M-5M KRW"],
    ["600", "5M-7M KRW"],
    ["800", "Over 7M KRW"],
    ["0", "Prefer not to say"],
  ],
  taxSensitivity: [
    ["optimize", "Important"],
    ["simple", "Not very important"],
    ["unknown", "Not sure yet"],
  ],
  travelType: [
    ["혼자 (솔로)", "Solo"],
    ["배우자/파트너 동반", "With spouse / partner"],
    ["자녀 동반 (배우자 없이)", "With children"],
    ["가족 전체 동반", "Whole family"],
  ],
  spouseIncome: [
    ["없음", "No"],
    ["있음", "Yes"],
  ],
  childrenAge: [
    ["0~2", "Infant (0-2)"],
    ["3~6", "Preschool (3-6)"],
    ["7~12", "Elementary (7-12)"],
    ["13~18", "Teenager (13-18)"],
  ],
  region: [
    ["아시아", "Asia"],
    ["유럽", "Europe"],
    ["중남미", "Latin America"],
    ["중동/아프리카", "Middle East / Africa"],
    ["북미", "North America"],
  ],
  lifestyle: [
    ["일하기 좋은 인프라", "Work-friendly infrastructure"],
    ["한인 커뮤니티 활성화", "Active Korean community"],
    ["저렴한 물가와 생활비", "Low prices and living costs"],
    ["영어로 생활 가능", "English-friendly daily life"],
  ],
};

function koreanOptions(values: string[]): OnboardingOption[] {
  return values.map((value) => ({ label: value, value }));
}

function englishOptions(entries: string[][]): OnboardingOption[] {
  return entries.map(([value, label]) => ({ label, value }));
}

const onboardingContent: Record<OnboardingLocale, OnboardingCopy> = {
  ko: {
    quiz: {
      questions: [
        {
          id: 1,
          question: "갑자기 떠나고 싶은 생각이 들었어.\n그 순간 떠오른 건?",
          options: [
            { label: "비행기가 곧 이륙할거야.", value: "A", persona: "wanderer" },
            { label: "외국인 친구들과 어울리는 내 모습.", value: "B", persona: "local" },
            { label: "글쎄, 일단 계획부터 세워야지.", value: "C", persona: "planner" },
            { label: "내 삶이 달라질 것 같아.", value: "D", persona: "free_spirit" },
            { label: "이제 한국은 돌아오지 않을거야.", value: "E", persona: "pioneer" },
          ],
        },
        {
          id: 2,
          question: "숙소 체크인 완료.\n가방을 내려놓고 제일 먼저 할 일은?",
          options: [
            { label: "일단 나가서 뭐가 있는지 볼래.", value: "A", persona: "wanderer" },
            { label: "동네 마트 먼저 가볼거야.", value: "B", persona: "local" },
            { label: "유심 구매하고 환전부터 해야해.", value: "C", persona: "planner" },
            { label: "창문 열고 바깥 풍경부터 볼래.", value: "D", persona: "free_spirit" },
            { label: "현지 식당 찾아서 로컬 음식 먹을거야.", value: "E", persona: "pioneer" },
          ],
        },
        {
          id: 3,
          question: "노마드 시작 첫 날이야.\n오늘 아침에 뭘 하고 싶어?",
          options: [
            { label: "느긋하게 브런치 먹으러 갈거야.", value: "A", persona: "free_spirit" },
            { label: "일어나서 운동부터 해야지.", value: "B", persona: "pioneer" },
            { label: "미리 찾아둔 장소에 가볼거야.", value: "C", persona: "wanderer" },
            { label: "짐 정리하고 밀린 일을 먼저 해치울래.", value: "D", persona: "planner" },
            { label: "골목 골목 동네를 둘러볼래.", value: "E", persona: "local" },
          ],
        },
        {
          id: 4,
          question: "노마드 생활 중 문제가 생겼어.\n피하고 싶은 최악의 상황은?",
          options: [
            { label: "바닥이 보이는 통장 잔고.", value: "A", persona: "planner" },
            { label: "내일이 비자 만료 하루 전날.", value: "B", persona: "wanderer" },
            { label: "믿었던 친구의 배신.", value: "C", persona: "local" },
            { label: "이룬 것 없이 한국으로 가야할 때.", value: "D", persona: "pioneer" },
            { label: "번아웃이 와버린 나 자신.", value: "E", persona: "free_spirit" },
          ],
        },
        {
          id: 5,
          question: "어느덧 노마드 6개월차,\n요즘 자주 하는 생각은?",
          options: [
            { label: "벌써 떠나야해? 아직 아쉬운데.", value: "A", persona: "local" },
            { label: "나 요즘 너무 행복한 것 같아.", value: "B", persona: "free_spirit" },
            { label: "여기 살아도 되겠는데?", value: "C", persona: "pioneer" },
            { label: "이제 여기도 떠날때가 된 것 같아.", value: "D", persona: "wanderer" },
            { label: "내 계획대로 잘 지내고 있어.", value: "E", persona: "planner" },
          ],
        },
        {
          id: 6,
          question: "드디어 내 최애 도시 발견!\n이제 어떻게 할래?",
          options: [
            { label: "영주권 알아볼거야. 진지하게.", value: "A", persona: "pioneer" },
            { label: "현지 시장 조사를 할거야.", value: "B", persona: "planner" },
            { label: "이 도시를 마음껏 즐겨볼래.", value: "C", persona: "free_spirit" },
            { label: "부동산 먼저 알아볼래.", value: "D", persona: "local" },
            { label: "그래도 더 좋은데가 있을걸?", value: "E", persona: "wanderer" },
          ],
        },
        {
          id: 7,
          question: "지금 이 순간,\n너한테 가장 끌리는 단어는?",
          options: [
            { label: "자유", value: "A", persona: "wanderer" },
            { label: "우정", value: "B", persona: "local" },
            { label: "성공", value: "C", persona: "planner" },
            { label: "행복", value: "D", persona: "free_spirit" },
            { label: "의지", value: "E", persona: "pioneer" },
          ],
        },
      ],
    },
    form: {
      preferredLanguage: "한국어",
      navigation: {
        back: "이전",
        next: "다음",
        skip: "건너뛰기",
        submit: "도시 추천 받기",
        loading: "당신에게 맞는 도시를 찾는 중이에요...",
        error: "뭔가 막혔어요. 다시 해볼까요?",
      },
      stepTitles: [
        "어떤 목적으로 노마드를\n준비하고 있어요?",
        "어떻게 지낼 계획이에요?",
        "비자 조건 확인을 위해,\n소득 구간을 알려주세요.",
        "같이 가는 사람이 있어요?",
        "마지막으로,\n더 알아야 할게 있다면 알려주세요.",
      ],
      shortStayBudgetTitle: "어울리는 도시 추천을 위해,\n이번 여정의 예산을 알려주세요.",
      labels: {
        timeline: "체류 기간",
        stayStyle: "체류 형태",
        monthlyBudget: "월 예산 (만원)",
        monthlyIncome: "월 소득 (만원)",
        taxSensitivity: "세금 혜택은 중요한가요?",
        spouseIncome: "배우자는 소득이 있나요?",
        spouseIncomeRange: "배우자의 월 소득 구간 (만원)",
        childrenAges: "아이들 나이대는 어떻게 돼요?",
        preferredRegion: "가고 싶은 지역이 있어요?",
        lifestyle: "노마드 선호 환경은요?",
        visaAccuracyWarning: "비자 추천 정확도가 낮아질 수 있어요.",
      },
      personaBadge: {
        prefix: "",
        suffix: " 위한 도시를 찾아볼게요",
      },
      options: {
        purpose: koreanOptions(["원격 근무", "프리랜서 활동", "온라인 비즈니스 운영", "장기 여행", "은퇴 후 거주"]),
        timeline: koreanOptions(["1~3개월 단기 체류", "6개월 중기 체류", "1년 장기 체류", "영주권/이민 목표"]),
        stayStyle: [
          { label: "한 도시에 오래 머물기", value: "정착형" },
          { label: "2~3개 도시 순환하기", value: "순환형" },
          { label: "여러 나라 자유롭게 이동하기", value: "이동형" },
        ],
        budgetRange: [
          { label: "200 이하", value: "100" },
          { label: "200~400", value: "300" },
          { label: "400~600", value: "500" },
          { label: "600~800", value: "700" },
          { label: "800 이상", value: "900" },
          { label: "비공개", value: "0" },
        ],
        incomeRange: [
          { label: "200 이하", value: "150" },
          { label: "200~300", value: "250" },
          { label: "300~500", value: "400" },
          { label: "500~700", value: "600" },
          { label: "700 이상", value: "800" },
          { label: "비공개", value: "0" },
        ],
        taxSensitivity: [
          { label: "중요해요", value: "optimize" },
          { label: "크게 중요하지 않아요", value: "simple" },
          { label: "잘 모르겠어요", value: "unknown" },
        ],
        travelType: [
          { label: "혼자", value: "혼자 (솔로)" },
          { label: "배우자 동반", value: "배우자/파트너 동반" },
          { label: "자녀 동반", value: "자녀 동반 (배우자 없이)" },
          { label: "가족 전체 동반", value: "가족 전체 동반" },
        ],
        spouseIncome: [
          { label: "없음", value: "없음" },
          { label: "있음", value: "있음" },
        ],
        childrenAge: [
          { label: "영아 (0~2세)", value: "0~2" },
          { label: "미취학 (3~6세)", value: "3~6" },
          { label: "초등 (7~12세)", value: "7~12" },
          { label: "중고등 (13~18세)", value: "13~18" },
        ],
        region: koreanOptions(["아시아", "유럽", "중남미", "중동/아프리카", "북미"]),
        lifestyle: koreanOptions(["일하기 좋은 인프라", "한인 커뮤니티 활성화", "저렴한 물가와 생활비", "영어로 생활 가능"]),
      },
    },
    result: {
      headerPrefix: "당신의 노마드 타입은,",
      sections: {
        city: "이런 도시가 어울려요",
        work: "이렇게 일해요",
        moment: "이런 순간이 행복해요",
        value: "당신에게 중요한 건",
      },
      actions: {
        findCountry: "나에게 맞는 국가 찾으러 가기",
        retry: "처음부터 다시하기",
      },
      personas: {
        wanderer: {
          label: "거침없는 나그네",
          description: ["한 곳에 익숙해지는 순간,", "설레임보다 아쉬움이 먼저 와요.", "더 보고 싶고, 더 느끼고 싶어요.", "많이 돌아다닐수록 내가 더 넓어지는 것 같아서요."],
          city: ["한 도시로는 만족할 수 없어요.", "지금은 북적이는 도시에 있지만,", "다음엔 조용한 마을로,", "아니면 항구 도시가 될 수도 있어요."],
          work: ["짐을 풀기도 전에 지도 앱을 켜요.", "새 도시의 첫 카페를 찾는 그 순간부터,", "이미 이 도시가 시작된 거예요."],
          value: ["언제든 떠날 수 있다는 믿음이에요.", "세상은 넓고, 가볼 곳은 너무 많아요."],
          moment: ["지금 있는 도시가 익숙해졌을 때,", "다음 도시가 벌써 궁금해져요.", "당신은 그게 숙제가 아닌", "기대감으로 느껴지는 사람이에요."],
        },
        local: {
          label: "어디서든 현지인",
          description: ["먼저 다가가는 편은 아닌데,", "어느새 이름을 부르는 사이가 되어 있어요.", "사람이 생기면, 그 도시가 달라 보이거든요."],
          city: ["오래된 골목과 노마드 카페가", "자연스럽게 섞인 도시예요."],
          work: ["처음엔 그냥 옆자리였지만,", "어느새 노트북을 올려두고", "함께 일하는 친구가 되어 있어요."],
          value: ["길 위에서 만나는 뜻밖의 인연이에요.", "친구들이 늘어나면,", "내 삶이 달라지기 시작해요."],
          moment: ["아무도 모르는 도시에서", "누군가 내 이름을 먼저 불러줬을 때,", "그 순간 여기가 우리 동네가 돼요."],
        },
        planner: {
          label: "영리한 설계자",
          description: ["예쁜 곳보다 살기 좋은 곳이 좋아요.", "설명하기는 어렵지만,", "여기서 살면 어떨지 금방 느껴져요.", "그 감이 틀린 적이 별로 없어요."],
          city: ["살기 좋은 도시가 좋아요.", "빠른 인터넷, 편리한 교통, 안전한 동네.", "이 세 가지면 충분해요."],
          work: ["자주 가는 카페에 자주 앉는 자리,", "검증된 루틴.", "어디서든 내 페이스를 잃지 않아요."],
          value: ["현실 감각이 알려주는 합리적인 판단이에요.", "살기 좋아야 오래 머물고 싶거든요."],
          moment: ["고민 끝에 정한 도시가", "예상보다 내 취향일 때,", "당신의 판단력은 이번에도 맞았어요."],
        },
        free_spirit: {
          label: "자유로운 영혼",
          description: ["오늘 뭘 했는지 딱히 말하기 어려운데,", "이상하게 만족스러운 날이 있어요.", "계획대로 된 하루보다 그런 날이 더 좋아요."],
          city: ["걷다 보면 자꾸 멈추게 되는 도시예요.", "예쁜 골목, 작은 카페 하나로", "하루가 충분해졌어요."],
          work: ["오늘 얼마나 일했는지 잘 몰라요.", "하고 싶을 때 했고,", "쉬고 싶을 때 쉬었어요."],
          value: ["작지만 소중한 일상이에요.", "행복하다면,", "잠시 여기 지내도 될 거예요."],
          moment: ["벤치에 앉아 음악을 듣고,", "따뜻한 햇빛을 느낄 때,", "당신은 아무 계획 없던 하루가", "그것만으로 충분하다는 걸 아는 사람이에요."],
        },
        pioneer: {
          label: "용감한 개척자",
          description: ["여행 중에 문득,", "여기 살아도 되겠다 싶은 순간이 와요.", "근데 그 생각이 그냥 스치지 않아요.", "어떻게 하면 될지 벌써 찾아보고 있어요."],
          city: ["관광지보다 동네가 좋아요.", "매일 사람들이 출근하며 오가는,", "그 길 위에 나도 있어요."],
          work: ["눈 뜨면 동네를 조깅해요.", "그리고 아침 일찍 카페로 출근해요.", "여기가 낯선 도시라는 걸 가끔 잊어요."],
          value: ["도시에게 느끼는 신뢰예요.", "어떤 이유로든,", "여기 있어도 된다는 확신이 생겨야 해요."],
          moment: ["낯선 도시에서 문득", "'여기 살고 싶다'라는 생각이 들었을 때,", "당신은 그게 꿈이 아닌", "계획처럼 느껴지는 사람이에요."],
        },
      },
    },
  },
  en: {
    quiz: {
      questions: [
        {
          id: 1,
          question: "You suddenly feel like leaving.\nWhat comes to mind first?",
          options: [
            { label: "The plane is about to take off.", value: "A", persona: "wanderer" },
            { label: "Me, hanging out with friends from everywhere.", value: "B", persona: "local" },
            { label: "First, I need a plan.", value: "C", persona: "planner" },
            { label: "My life might finally change.", value: "D", persona: "free_spirit" },
            { label: "I may never move back home.", value: "E", persona: "pioneer" },
          ],
        },
        {
          id: 2,
          question: "Check-in is done.\nAfter dropping your bag, what do you do first?",
          options: [
            { label: "Go outside and see what's around.", value: "A", persona: "wanderer" },
            { label: "Find the neighborhood grocery store.", value: "B", persona: "local" },
            { label: "Get a SIM card and exchange cash first.", value: "C", persona: "planner" },
            { label: "Open the window and look at the view.", value: "D", persona: "free_spirit" },
            { label: "Find a local restaurant and eat what locals eat.", value: "E", persona: "pioneer" },
          ],
        },
        {
          id: 3,
          question: "It's your first nomad morning.\nWhat do you want to do today?",
          options: [
            { label: "Take it slow and go out for brunch.", value: "A", persona: "free_spirit" },
            { label: "Wake up and exercise first.", value: "B", persona: "pioneer" },
            { label: "Visit the places I saved in advance.", value: "C", persona: "wanderer" },
            { label: "Unpack and clear my work backlog.", value: "D", persona: "planner" },
            { label: "Wander through the neighborhood streets.", value: "E", persona: "local" },
          ],
        },
        {
          id: 4,
          question: "Something goes wrong during nomad life.\nWhich situation would you hate most?",
          options: [
            { label: "A bank balance almost at zero.", value: "A", persona: "planner" },
            { label: "Realizing tomorrow is the last day of your visa.", value: "B", persona: "wanderer" },
            { label: "Being let down by someone you trusted.", value: "C", persona: "local" },
            { label: "Having to go home with nothing built.", value: "D", persona: "pioneer" },
            { label: "Burning out completely.", value: "E", persona: "free_spirit" },
          ],
        },
        {
          id: 5,
          question: "Six months into nomad life,\nwhat thought comes up often?",
          options: [
            { label: "Do I really have to leave already?", value: "A", persona: "local" },
            { label: "I think I'm genuinely happy these days.", value: "B", persona: "free_spirit" },
            { label: "I could actually live here.", value: "C", persona: "pioneer" },
            { label: "It may be time to move on again.", value: "D", persona: "wanderer" },
            { label: "Everything is going according to plan.", value: "E", persona: "planner" },
          ],
        },
        {
          id: 6,
          question: "You finally found your favorite city.\nWhat happens next?",
          options: [
            { label: "Look into permanent residency. Seriously.", value: "A", persona: "pioneer" },
            { label: "Research the local market.", value: "B", persona: "planner" },
            { label: "Enjoy this city as much as I can.", value: "C", persona: "free_spirit" },
            { label: "Start checking real estate first.", value: "D", persona: "local" },
            { label: "There might still be somewhere even better.", value: "E", persona: "wanderer" },
          ],
        },
        {
          id: 7,
          question: "Right now,\nwhich word pulls you in most?",
          options: [
            { label: "Freedom", value: "A", persona: "wanderer" },
            { label: "Friendship", value: "B", persona: "local" },
            { label: "Success", value: "C", persona: "planner" },
            { label: "Happiness", value: "D", persona: "free_spirit" },
            { label: "Resolve", value: "E", persona: "pioneer" },
          ],
        },
      ],
    },
    form: {
      preferredLanguage: "English",
      navigation: {
        back: "Back",
        next: "Next",
        skip: "Skip",
        submit: "Get city recommendations",
        loading: "Finding cities that fit you...",
        error: "Something got stuck. Try again?",
      },
      stepTitles: [
        "Why are you preparing\nfor nomad life?",
        "How are you planning to stay?",
        "To check visa conditions,\ntell us your income range.",
        "Who are you traveling with?",
        "Finally,\nanything else we should know?",
      ],
      shortStayBudgetTitle: "To recommend fitting cities,\ntell us this trip's budget.",
      labels: {
        timeline: "Stay duration",
        stayStyle: "Stay style",
        monthlyBudget: "Monthly budget (KRW)",
        monthlyIncome: "Monthly income (KRW)",
        taxSensitivity: "Do tax benefits matter to you?",
        spouseIncome: "Does your spouse have income?",
        spouseIncomeRange: "Spouse monthly income range (KRW)",
        childrenAges: "How old are the children?",
        preferredRegion: "Any region you want to go to?",
        lifestyle: "Preferred nomad environment",
        visaAccuracyWarning: "Visa recommendation accuracy may be lower.",
      },
      personaBadge: {
        prefix: "Finding cities for ",
        suffix: "",
      },
      options: {
        purpose: englishOptions(sharedOptionValues.purpose),
        timeline: englishOptions(sharedOptionValues.timeline),
        stayStyle: englishOptions(sharedOptionValues.stayStyle),
        budgetRange: englishOptions(sharedOptionValues.budgetRange),
        incomeRange: englishOptions(sharedOptionValues.incomeRange),
        taxSensitivity: englishOptions(sharedOptionValues.taxSensitivity),
        travelType: englishOptions(sharedOptionValues.travelType),
        spouseIncome: englishOptions(sharedOptionValues.spouseIncome),
        childrenAge: englishOptions(sharedOptionValues.childrenAge),
        region: englishOptions(sharedOptionValues.region),
        lifestyle: englishOptions(sharedOptionValues.lifestyle),
      },
    },
    result: {
      headerPrefix: "Your nomad type is",
      sections: {
        city: "Cities that fit you",
        work: "How you work",
        moment: "Moments that make you happy",
        value: "What matters to you",
      },
      actions: {
        findCountry: "Find countries that fit me",
        retry: "Start over",
      },
      personas: {
        wanderer: {
          label: "The Boundless Wanderer",
          description: ["The moment a place starts to feel familiar,", "you feel the next place calling.", "You want to see more and feel more.", "Every move makes your world feel wider."],
          city: ["One city is rarely enough.", "You might be in a busy capital now,", "then a quiet village next,", "or maybe a port city after that."],
          work: ["Before fully unpacking,", "you already have the map open.", "The first cafe in a new city is where the city begins."],
          value: ["The belief that you can leave whenever you need to.", "The world is wide, and there is still so much to see."],
          moment: ["When the city you're in starts feeling familiar,", "you already wonder about the next one.", "For you, that is not homework.", "It feels like anticipation."],
        },
        local: {
          label: "The Everywhere Local",
          description: ["You may not always approach first,", "but somehow people start knowing your name.", "Once you have people, the city feels different."],
          city: ["A city where old streets and nomad cafes", "blend naturally together."],
          work: ["At first, someone was just sitting nearby.", "Soon your laptop is on the same table,", "and they become a friend you work beside."],
          value: ["The unexpected bonds you find on the road.", "As your circle grows,", "your life starts changing with it."],
          moment: ["In a city where nobody knows you,", "someone calls your name first.", "That is when the place becomes your neighborhood."],
        },
        planner: {
          label: "The Clever Architect",
          description: ["You prefer livable over merely pretty.", "It is hard to explain,", "but you quickly sense whether a place would work.", "That instinct is usually right."],
          city: ["You want a city that works well.", "Fast internet, easy transit, and a safe neighborhood.", "Those three are enough."],
          work: ["A cafe you return to, a seat you trust,", "a routine that has already been tested.", "You keep your pace anywhere."],
          value: ["A practical sense for good decisions.", "If a place works well, you can stay longer."],
          moment: ["When the city you chose after careful thought", "fits you better than expected,", "your judgment proves right again."],
        },
        free_spirit: {
          label: "The Free Spirit",
          description: ["Some days are hard to summarize,", "but somehow they feel deeply satisfying.", "You prefer those days to a perfectly scheduled one."],
          city: ["A city that keeps making you stop while walking.", "A pretty alley or one small cafe", "can make the day feel complete."],
          work: ["You may not know exactly how many hours you worked.", "You worked when you wanted to,", "and rested when you needed to."],
          value: ["Small but precious everyday moments.", "If you are happy,", "staying here for a while is enough."],
          moment: ["Sitting on a bench, listening to music,", "feeling warm sunlight,", "you know an unplanned day", "can be enough on its own."],
        },
        pioneer: {
          label: "The Bold Pioneer",
          description: ["During a trip, a thought suddenly appears:", "I could live here.", "But it does not just pass by.", "You are already looking up how to make it real."],
          city: ["You prefer neighborhoods to tourist spots.", "People commute through these streets every day,", "and you can imagine yourself among them."],
          work: ["You wake up and jog through the area.", "Then you head to a cafe early.", "Sometimes you forget this city was ever unfamiliar."],
          value: ["The trust you feel toward a city.", "For any reason at all,", "you need the conviction that you can be here."],
          moment: ["When a strange city makes you think,", "'I want to live here,'", "you do not feel it as a dream.", "You feel it becoming a plan."],
        },
      },
    },
  },
};

export function getOnboardingCopy(locale: string): OnboardingCopy {
  return onboardingContent[normalizeOnboardingLocale(locale)];
}
