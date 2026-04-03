"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";

interface CityResult {
  city: string;
  city_kr: string;
  country: string;
  country_id: string;
  visa_type: string;
  visa_url: string;
  monthly_cost_usd: number;
  score: number;
  reasons: string[];
  realistic_warnings: string[];
  plan_b_trigger: boolean;
  references: string[];
}

interface RecommendResult {
  markdown: string;
  cities: CityResult[];
  parsed: {
    top_cities: CityResult[];
    overall_warning: string;
    _user_profile: Record<string, unknown>;
  };
}

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<RecommendResult | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("nnai_result");
    if (!stored) {
      router.replace("/onboarding/quiz");
      return;
    }
    try {
      setResult(JSON.parse(stored));
    } catch {
      router.replace("/onboarding/quiz");
    }
  }, [router]);

  if (!result) return null;

  function handleRetry() {
    sessionStorage.removeItem("nnai_result");
    sessionStorage.removeItem("persona_type");
    router.push("/onboarding/quiz");
  }

  const cities = result.cities;
  const topCities = result.parsed.top_cities;
  const overallWarning = result.parsed.overall_warning;
  const rankBadge = ["1st", "2nd", "3rd"];

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      {/* 1. 헤더 */}
      <p className="text-xs text-muted-foreground tracking-widest mb-6">
        당신에게 맞는 도시 TOP 3
      </p>

      {/* 2. 도시 카드 */}
      {cities.map((city, i) => (
        <div
          key={city.city}
          className="rounded-lg border border-border bg-card p-5 mb-4"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {rankBadge[i]}
            </span>
            <span className="text-lg font-bold text-foreground">
              {city.city_kr}
            </span>
            <span className="text-sm text-muted-foreground">
              {city.country}
            </span>
          </div>

          <div className="border-t border-border my-3" />

          <div className="space-y-2">
            <div>
              <span className="text-xs text-muted-foreground">비자 </span>
              <span className="text-sm text-foreground">{city.visa_type}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">월 예상 생활비 </span>
              <span className="text-sm font-medium text-foreground">
                ${city.monthly_cost_usd.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">추천 점수 </span>
              <span className="text-sm font-medium text-primary">
                {city.score}/10
              </span>
            </div>
            {city.visa_url && (
              <a
                href={city.visa_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-primary hover:underline"
              >
                비자 정보 보기 →
              </a>
            )}
            {city.plan_b_trigger && (
              <span className="mt-3 inline-block rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                ⚠️ 플랜 B 검토 권장
              </span>
            )}
          </div>
        </div>
      ))}

      {/* 3. 도시 비교표 */}
      <p className="text-sm font-semibold text-foreground mb-4 mt-8">
        도시 비교
      </p>

      {overallWarning && (
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground mb-6">
          {overallWarning}
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="w-20 whitespace-nowrap bg-muted text-xs text-muted-foreground text-left px-3 py-2 border border-border" />
              {topCities.map((city) => (
                <th
                  key={city.city}
                  className="bg-muted text-xs text-muted-foreground text-center px-3 py-2 border border-border"
                >
                  {city.city_kr}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="w-20 whitespace-nowrap text-xs text-muted-foreground text-left align-top bg-muted px-3 py-2 border border-border">
                비자
              </td>
              {topCities.map((city) => (
                <td key={city.city} className="text-center align-top break-keep text-xs px-3 py-2 border border-border">
                  {city.visa_type}
                </td>
              ))}
            </tr>
            <tr>
              <td className="w-20 whitespace-nowrap text-xs text-muted-foreground text-left align-top bg-muted px-3 py-2 border border-border">
                월 생활비
              </td>
              {topCities.map((city) => (
                <td key={city.city} className="text-center align-top break-keep px-3 py-2 border border-border">
                  ${city.monthly_cost_usd.toLocaleString()}
                </td>
              ))}
            </tr>
            <tr>
              <td className="w-20 whitespace-nowrap text-xs text-muted-foreground text-left align-top bg-muted px-3 py-2 border border-border">
                추천 점수
              </td>
              {topCities.map((city) => (
                <td key={city.city} className="text-center align-top break-keep px-3 py-2 border border-border text-primary">
                  {city.score}/10
                </td>
              ))}
            </tr>
            {topCities.some((c) => c.plan_b_trigger) && (
              <tr>
                <td className="w-20 whitespace-nowrap text-xs text-muted-foreground text-left align-top bg-muted px-3 py-2 border border-border">
                  플랜 B
                </td>
                {topCities.map((city) => (
                  <td key={city.city} className="text-center align-top break-keep px-3 py-2 border border-border">
                    {city.plan_b_trigger ? "검토 필요" : "해당 없음"}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. 하단 CTA */}
      <button
        type="button"
        onClick={handleRetry}
        className="w-full mt-8 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        처음부터 다시하기
      </button>
    </div>
  );
}
