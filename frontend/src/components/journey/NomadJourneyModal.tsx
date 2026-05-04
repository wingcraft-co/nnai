"use client";

import { useCallback, useEffect, useState } from "react";
import { LocateFixed, MapPin, Users, UserRound, X } from "lucide-react";
import cityScores from "@/data/city_scores.json";
import {
  type JourneyContinent,
  trackJourneyFlagSaveSuccess,
  trackJourneyGithubIssueLinked,
  trackJourneyCitySelect,
  trackJourneyContinentSelect,
  trackJourneyCountrySelect,
  trackJourneyGpsVerifyClick,
  trackJourneyGpsVerifyFailure,
  trackJourneyGpsVerifySuccess,
  trackJourneyMapOpen,
  trackJourneySaveClick,
  trackJourneySaveSuccess,
  trackJourneyUnsupportedCitySelect,
  trackJourneyUnsupportedSearchSubmit,
} from "@/lib/analytics/events";
import { buildGoogleLoginUrl } from "@/lib/legal-content.mjs";
import {
  buildJourneyCityOptions,
  buildJourneyCountryOptions,
  filterJourneyCitiesByCountry,
  filterJourneyCountriesByContinent,
  resolveJourneyFlagColor,
  resolveJourneyLocation,
} from "@/lib/journey-map.mjs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

type JourneyContinentValue = JourneyContinent;

type JourneyCityOption = {
  id: string;
  city: string;
  city_kr: string;
  country: string;
  country_code: string;
  lat: number;
  lng: number;
  search_index: string;
  gps_confirmed?: boolean;
  gps_distance_km?: number;
};

const CITY_OPTIONS = buildJourneyCityOptions(cityScores) as JourneyCityOption[];

type JourneyCountryOption = {
  country: string;
  country_code: string;
  continent: JourneyContinentValue;
  city_count: number;
  city_ids: string[];
  lat: number;
  lng: number;
};

const COUNTRY_OPTIONS = buildJourneyCountryOptions(CITY_OPTIONS) as JourneyCountryOption[];
const CONTINENT_MARKERS: Array<{
  id: JourneyContinentValue;
  label: string;
  x: number;
  y: number;
  size: number;
}> = [
  { id: "Americas", label: "아메리카", x: 28, y: 54, size: 104 },
  { id: "Europe", label: "유럽", x: 51, y: 33, size: 92 },
  { id: "Africa", label: "아프리카", x: 53, y: 61, size: 86 },
  { id: "Middle East", label: "중동", x: 65, y: 52, size: 78 },
  { id: "Asia", label: "아시아", x: 74, y: 46, size: 112 },
];

type AuthState = {
  logged_in: boolean;
  name?: string;
};

type JourneyStop = {
  id: number;
  city: string;
  country: string;
  country_code?: string | null;
  lat: number;
  lng: number;
  note: string;
  persona_type?: string | null;
  flag_color?: JourneyFlagColor | null;
  gps_verified?: boolean | null;
  github_issue_status?: string | null;
  created_at: string;
};

type CommunityStop = {
  city: string;
  country: string;
  country_code?: string | null;
  lat: number;
  lng: number;
  cnt: number;
  flag_color?: JourneyFlagColor | null;
};

type JourneyFlagColor = "green" | "red" | "yellow";
type GpsState = "idle" | "requesting" | "verified" | "denied" | "unavailable" | "mismatch";

type GeocodeResult = {
  city: string;
  country: string;
  country_code: string;
  lat: number;
  lng: number;
  supported: boolean;
  supported_city_id: string | null;
  geocode_result_id: string | null;
  location_source: string;
  display_name: string;
};

function nearestCity(lat: number, lng: number) {
  return CITY_OPTIONS.reduce((best, city) => {
    const score = Math.hypot(city.lat - lat, city.lng - lng);
    return score < best.score ? { city, score } : best;
  }, { city: CITY_OPTIONS[0], score: Number.POSITIVE_INFINITY }).city;
}

function markerStyle(point: { x: number; y: number }) {
  return {
    left: `${point.x}%`,
    top: `${point.y}%`,
  };
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function flagColorClass(color: JourneyFlagColor | string | null | undefined) {
  if (color === "green") return "text-[#38b96b]";
  if (color === "yellow") return "text-[#ffc93d]";
  return "text-[#f45b5b]";
}

function flagBgClass(color: JourneyFlagColor | string | null | undefined) {
  if (color === "green") return "bg-[#38b96b]";
  if (color === "yellow") return "bg-[#ffc93d] text-[#272225]";
  return "bg-[#f45b5b]";
}

export function NomadJourneyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [auth, setAuth] = useState<AuthState>({ logged_in: false });
  const [myStops, setMyStops] = useState<JourneyStop[]>([]);
  const [community, setCommunity] = useState<CommunityStop[]>([]);
  const [personaCommunity, setPersonaCommunity] = useState<CommunityStop[]>([]);
  const [showCommunity, setShowCommunity] = useState(false);
  const [showPersona, setShowPersona] = useState(false);
  const [activeContinent, setActiveContinent] = useState<JourneyContinentValue | null>(null);
  const [activeCountryCode, setActiveCountryCode] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [selectedGeocodeResult, setSelectedGeocodeResult] = useState<GeocodeResult | null>(null);
  const [unsupportedQuery, setUnsupportedQuery] = useState("");
  const [unsupportedResults, setUnsupportedResults] = useState<GeocodeResult[]>([]);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [gpsVerified, setGpsVerified] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [personaType, setPersonaType] = useState("");
  const [previewAnimationKey, setPreviewAnimationKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setPersonaType(localStorage.getItem("persona_type") ?? "");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    trackJourneyMapOpen();
  }, [open]);

  const refresh = useCallback(async () => {
    const me = await fetch(`${API_BASE}/auth/me`, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .catch(() => ({ logged_in: false }));
    setAuth(me);

    const communityRows = await fetch(`${API_BASE}/api/journey/community`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    setCommunity(communityRows);

    if (personaType) {
      const personaRows = await fetch(
        `${API_BASE}/api/journey/community?persona_type=${encodeURIComponent(personaType)}`,
        { cache: "no-store" },
      )
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
      setPersonaCommunity(personaRows);
    } else {
      setPersonaCommunity([]);
    }

    if (me.logged_in) {
      const stops = await fetch(`${API_BASE}/api/journey/me`, {
        credentials: "include",
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
      setMyStops(stops);
    } else {
      setMyStops([]);
    }
  }, [personaType]);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  const visibleCommunity = showPersona && personaCommunity.length > 0 ? personaCommunity : community;
  const selectedCity = CITY_OPTIONS.find((city) => city.id === selectedCityId) ?? null;
  const selectedLocation = selectedGeocodeResult ?? selectedCity;
  const selectedIsSupported = Boolean(selectedCity && !selectedGeocodeResult);
  const pendingFlagColor = selectedLocation
    ? resolveJourneyFlagColor({ supported: selectedIsSupported, gpsVerified }) as JourneyFlagColor
    : "red";
  const activeCountries = activeContinent
    ? filterJourneyCountriesByContinent(COUNTRY_OPTIONS, activeContinent) as JourneyCountryOption[]
    : [];
  const activeCities = activeCountryCode
    ? filterJourneyCitiesByCountry(CITY_OPTIONS, activeCountryCode) as JourneyCityOption[]
    : [];
  const activeCountry = activeCountryCode
    ? COUNTRY_OPTIONS.find((country) => country.country_code === activeCountryCode) ?? null
    : null;

  function selectContinent(continent: JourneyContinentValue) {
    setActiveContinent(continent);
    setActiveCountryCode(null);
    setSelectedCityId(null);
    setSelectedGeocodeResult(null);
    setUnsupportedQuery("");
    setUnsupportedResults([]);
    setGpsState("idle");
    setGpsVerified(false);
    setStatus("");
    trackJourneyContinentSelect(continent);
  }

  function selectCountry(country: JourneyCountryOption) {
    setActiveCountryCode(country.country_code);
    setSelectedCityId(null);
    setSelectedGeocodeResult(null);
    setUnsupportedQuery("");
    setUnsupportedResults([]);
    setGpsState("idle");
    setGpsVerified(false);
    setStatus("");
    trackJourneyCountrySelect(country.country_code);
  }

  function selectCity(city: JourneyCityOption) {
    const next = selectedCityId === city.id ? null : city.id;
    setSelectedCityId(next);
    setSelectedGeocodeResult(null);
    setGpsState("idle");
    setGpsVerified(false);
    if (next) {
      trackJourneyCitySelect(city.id);
      setPreviewAnimationKey((key) => key + 1);
    }
    setStatus("");
  }

  function resetContinent() {
    setActiveContinent(null);
    setActiveCountryCode(null);
    setSelectedCityId(null);
    setSelectedGeocodeResult(null);
    setUnsupportedQuery("");
    setUnsupportedResults([]);
    setGpsState("idle");
    setGpsVerified(false);
    setStatus("");
  }

  function resetCountry() {
    setActiveCountryCode(null);
    setSelectedCityId(null);
    setSelectedGeocodeResult(null);
    setUnsupportedQuery("");
    setUnsupportedResults([]);
    setGpsState("idle");
    setGpsVerified(false);
    setStatus("");
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setGpsState("unavailable");
      setStatus("이 브라우저에서는 위치 인증을 사용할 수 없습니다.");
      return;
    }
    trackJourneyGpsVerifyClick();
    setGpsState("requesting");
    setStatus("현재 위치를 확인하는 중입니다.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (selectedLocation) {
          const distance = distanceKm(
            position.coords.latitude,
            position.coords.longitude,
            selectedLocation.lat,
            selectedLocation.lng,
          );
          if (distance <= 60) {
            setGpsState("verified");
            setGpsVerified(true);
            trackJourneyGpsVerifySuccess();
            setStatus(`${selectedLocation.city} 근처의 현재 GPS 좌표로 확인했습니다.`);
          } else {
            setGpsState("mismatch");
            setGpsVerified(false);
            trackJourneyGpsVerifyFailure("distance_mismatch");
            setStatus(`${selectedLocation.city}와 현재 위치가 ${Math.round(distance)}km 떨어져 있어 GPS 인증하지 않았습니다.`);
          }
          return;
        }

        const city = resolveJourneyLocation(
          CITY_OPTIONS,
          position.coords.latitude,
          position.coords.longitude,
        ) as JourneyCityOption | null;

        if (!city) {
          const fallbackCity = nearestCity(position.coords.latitude, position.coords.longitude);
          setGpsState("mismatch");
          setGpsVerified(false);
          trackJourneyGpsVerifyFailure("no_supported_city_nearby");
          setStatus(`${fallbackCity.city}와 거리가 있어 자동 등록하지 않았습니다. 지도에서 도시를 선택해주세요.`);
          return;
        }

        const country = COUNTRY_OPTIONS.find((option) => option.country_code === city.country_code);
        setActiveContinent(country?.continent ?? null);
        setActiveCountryCode(city.country_code);
        setSelectedCityId(city.id);
        setSelectedGeocodeResult(null);
        setGpsState("verified");
        setGpsVerified(true);
        setPreviewAnimationKey((key) => key + 1);
        trackJourneyCitySelect(city.id);
        trackJourneyGpsVerifySuccess();
        setStatus(`${city.city} 근처의 현재 GPS 좌표로 확인했습니다. 그대로 깃발을 꽂을 수 있습니다.`);
      },
      () => {
        setGpsState("denied");
        setGpsVerified(false);
        trackJourneyGpsVerifyFailure("permission_denied");
        setStatus("위치 권한을 확인하지 못했습니다. 지원 도시는 빨간 깃발로 저장할 수 있습니다.");
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  async function searchUnsupportedCity() {
    if (!activeCountryCode || unsupportedQuery.trim().length < 2 || geocodeLoading) return;
    setGeocodeLoading(true);
    setStatus("");
    trackJourneyUnsupportedSearchSubmit(activeCountryCode);
    try {
      const response = await fetch(`${API_BASE}/api/journey/geocode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: unsupportedQuery.trim(), country_code: activeCountryCode }),
      });
      if (!response.ok) {
        throw new Error(response.status === 503 ? "도시 확인 서버가 잠시 쉬고 있어요." : "도시를 확인하지 못했습니다.");
      }
      const payload = await response.json() as { results?: GeocodeResult[] };
      const results = (payload.results ?? []).filter((result) => !result.supported && result.geocode_result_id);
      setUnsupportedResults(results);
      if (results.length === 0) {
        setStatus("목록 밖 도시를 찾지 못했습니다. 도시명과 국가를 다시 확인해주세요.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "도시를 확인하지 못했습니다.");
    } finally {
      setGeocodeLoading(false);
    }
  }

  function selectUnsupportedCity(result: GeocodeResult) {
    setSelectedCityId(null);
    setSelectedGeocodeResult(result);
    setGpsState("idle");
    setGpsVerified(false);
    setPreviewAnimationKey((key) => key + 1);
    trackJourneyUnsupportedCitySelect(result.country_code);
    setStatus("목록 밖 도시는 GPS 인증 후 노란 깃발로 저장할 수 있습니다.");
  }

  async function saveStop() {
    if (!selectedLocation) {
      setStatus("도시를 먼저 선택해주세요.");
      return;
    }
    trackJourneySaveClick(auth.logged_in);
    if (!auth.logged_in) {
      window.location.assign(buildGoogleLoginUrl(API_BASE, window.location.href));
      return;
    }
    if (selectedGeocodeResult && !gpsVerified) {
      setStatus("목록 밖 도시는 GPS 인증 후 저장할 수 있습니다.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const body = selectedGeocodeResult
        ? {
            geocode_result_id: selectedGeocodeResult.geocode_result_id,
            gps_verified: true,
            note,
          }
        : {
            city_id: selectedCity?.id,
            gps_verified: gpsVerified,
            note,
          };
      const response = await fetch(`${API_BASE}/api/journey/stops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const message = response.status === 422 ? "방명록은 10글자 이내로 입력해주세요." : "깃발을 저장하지 못했습니다.";
        throw new Error(message);
      }
      const saved = await response.json() as {
        flag_color?: JourneyFlagColor;
        is_supported_city?: boolean;
        gps_verified?: boolean;
        github_issue_status?: string;
      };
      setNote("");
      setStatus("깃발을 꽂았습니다.");
      if (selectedCity) trackJourneySaveSuccess(selectedCity.id);
      trackJourneyFlagSaveSuccess({
        flagColor: saved.flag_color ?? pendingFlagColor,
        supported: Boolean(saved.is_supported_city ?? selectedIsSupported),
        gpsVerified: Boolean(saved.gps_verified ?? gpsVerified),
      });
      if (saved.github_issue_status && saved.github_issue_status !== "not_required") {
        trackJourneyGithubIssueLinked(saved.github_issue_status);
      }
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "깃발을 저장하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/82 p-3 text-[#fffaf2] backdrop-blur-sm sm:p-6 lg:p-8"
      onClick={onClose}
    >
      <div
        className="relative mx-auto h-full max-h-[860px] max-w-6xl overflow-hidden border border-white/20 bg-[#1a1a2e] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_42%_45%,rgba(120,191,224,0.16),transparent_42%),radial-gradient(circle_at_50%_55%,rgba(255,250,242,0.08),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-3 py-20 lg:justify-start lg:px-16 lg:py-12">
        <style>
          {`
            @keyframes journeyFlagDrop {
              0% { opacity: 0; transform: translate(-50%, -50%) translateY(-38px) scale(0.72); }
              62% { opacity: 1; transform: translate(-50%, -50%) translateY(4px) scale(1.04); }
              100% { opacity: 1; transform: translate(-50%, -50%) translateY(0) scale(1); }
            }
            @keyframes journeyFlagPulse {
              0% { opacity: 0.38; transform: translate(-50%, -50%) scale(0.65); }
              100% { opacity: 0; transform: translate(-50%, -50%) scale(2.4); }
            }
            .journey-preview-flag { animation: journeyFlagDrop 520ms cubic-bezier(.2,.9,.2,1) both; transform-origin: center bottom; }
            .journey-preview-pulse { animation: journeyFlagPulse 900ms ease-out both; transform-origin: center; }
          `}
        </style>
        <div className="relative aspect-square w-[min(78vh,calc(100vw-2rem))] max-w-[720px] overflow-hidden rounded-full border-[6px] border-[#fffaf2]/70 bg-[#78bfe0]/20 shadow-[0_0_0_6px_rgba(39,34,37,0.65),16px_16px_0_rgba(8,8,14,0.42)] lg:w-[min(76vh,calc(100vw-470px))]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/earth_web.gif"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-95 [image-rendering:pixelated]"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_34%_28%,rgba(255,250,242,0.28),transparent_24%),radial-gradient(circle_at_72%_72%,rgba(10,11,22,0.32),transparent_42%)]" />
          <div className="pointer-events-auto absolute inset-[7%]">
          {!activeContinent && CONTINENT_MARKERS.map((marker) => (
            <button
              key={marker.id}
              type="button"
              aria-label={`${marker.label} 선택`}
              onClick={() => selectContinent(marker.id)}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center border-4 border-[#fffaf2]/80 bg-[#d1842c]/72 text-xs font-black text-[#fffaf2] shadow-[5px_5px_0_rgba(8,8,14,0.42)] transition hover:-translate-y-[54%] hover:bg-[#d1842c] focus:outline-none focus:ring-2 focus:ring-[#fffaf2]"
              style={{
                ...markerStyle(marker),
                width: Math.max(76, marker.size - 10),
                height: Math.max(76, marker.size - 10),
              }}
            >
              {marker.label}
            </button>
          ))}

          {activeContinent && (
            <div className="absolute left-1/2 top-[18%] w-[min(82%,360px)] -translate-x-1/2 border-4 border-[#fffaf2]/80 bg-[#272225]/78 px-4 py-3 text-center shadow-[6px_6px_0_rgba(8,8,14,0.48)]">
              <p className="text-[10px] font-black uppercase tracking-normal text-[#ffc93d]">Stage Select</p>
              <p className="mt-1 text-lg font-black text-[#fffaf2]">
                {activeCountry?.country ?? activeContinent}
              </p>
              <p className="mt-1 text-xs font-bold text-[#fffaf2]/78">
                {selectedLocation ? `${selectedLocation.city} 깃발 준비` : "오른쪽 패널에서 국가와 도시를 골라주세요"}
              </p>
            </div>
          )}

          {selectedLocation && (
            <div
              key={`preview-${selectedLocation.city}-${previewAnimationKey}`}
              className="absolute left-1/2 top-[58%]"
            >
              <span className={`journey-preview-pulse absolute left-0 top-0 size-12 ${flagBgClass(pendingFlagColor)}`} />
              <span className={`journey-preview-flag absolute left-0 top-0 h-14 w-10 border-4 border-[#fffaf2] shadow-[5px_5px_0_rgba(8,8,14,0.58)] ${flagBgClass(pendingFlagColor)}`} />
              <span className="absolute left-5 top-16 w-44 -translate-x-1/2 border-2 border-[#fffaf2]/80 bg-[#272225]/82 px-2 py-1 text-center text-xs font-black text-[#fffaf2]">
                {selectedLocation.city}
              </span>
            </div>
          )}
          </div>
        </div>
      </div>

      <div className="absolute left-3 right-3 top-3 z-30 flex h-11 items-center justify-between border border-white/20 bg-[#fffaf2]/90 px-3 text-[#1D1D1F] shadow-xl backdrop-blur-md lg:left-6 lg:right-6 lg:top-5">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-[#d1842c]" />
          <span className="size-2.5 rounded-full bg-[#c8beb0]" />
          <span className="size-2.5 rounded-full bg-[#756c60]" />
        </div>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-normal text-[#756c60]">Nomad Journey</p>
          <h2 className="font-serif text-sm font-semibold leading-none text-[#1D1D1F]">내 노마드 여정 지도</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center border border-[#d8d0c4] bg-white text-[#1D1D1F] transition-colors hover:bg-[#f1eadf]"
          aria-label="지도 닫기"
        >
          <X className="size-4" />
        </button>
      </div>

      <aside className="absolute inset-x-3 bottom-3 z-30 max-h-[48vh] overflow-y-auto border border-white/20 bg-[#fffaf2]/94 p-3 text-[#1D1D1F] shadow-2xl backdrop-blur-md lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-20 lg:w-[370px] lg:max-h-none lg:p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={showCommunity}
              onClick={() => setShowCommunity((value) => !value)}
              className={`inline-flex h-10 items-center justify-center gap-2 border px-3 text-sm font-medium transition-colors ${showCommunity ? "border-[#d1842c] bg-[#d1842c] text-white" : "border-[#d8d0c4] bg-white text-[#1D1D1F] hover:bg-[#f1eadf]"}`}
            >
              <Users className="size-4" />
              전체 보기
            </button>
            <button
              type="button"
              aria-pressed={showPersona}
              onClick={() => setShowPersona((value) => !value)}
              disabled={!personaType}
              className={`inline-flex h-10 items-center justify-center gap-2 border px-3 text-sm font-medium transition-colors disabled:opacity-40 ${showPersona ? "border-[#d1842c] bg-[#d1842c] text-white" : "border-[#d8d0c4] bg-white text-[#1D1D1F] hover:bg-[#f1eadf]"}`}
            >
              <UserRound className="size-4" />
              내 타입
            </button>
          </div>

          <div className="border border-[#d8d0c4] bg-white p-3">
            <p className="mb-1 text-sm font-semibold text-[#1D1D1F]">내 발자취 남기기</p>
            <p className="mb-3 text-xs leading-relaxed text-[#756c60]">
              내 발자취를 남기고 저장해서 나만의 디지털노마드 log를 완성해보세요.
            </p>
            <button
              type="button"
              onClick={requestLocation}
              className="mb-3 inline-flex h-10 w-full items-center gap-2 border border-[#d8d0c4] bg-[#f7f1e8] px-3 text-left text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-[#efe4d4]"
            >
              <LocateFixed className="size-4" />
              현재 위치로 도시 찾기
            </button>

            {activeContinent && (
              <button
                type="button"
                onClick={resetContinent}
                className="mb-2 text-xs font-semibold text-[#756c60] transition-colors hover:text-[#1D1D1F]"
              >
                ← 대륙 다시 선택
              </button>
            )}

            {activeCountry && (
              <button
                type="button"
                onClick={resetCountry}
                className="mb-2 ml-3 text-xs font-semibold text-[#756c60] transition-colors hover:text-[#1D1D1F]"
              >
                ← 국가 다시 선택
              </button>
            )}

            {!activeContinent && (
              <p className="text-xs leading-relaxed text-[#756c60]">지도에서 대륙을 먼저 선택하세요.</p>
            )}

            {activeContinent && !activeCountry && (
              <div className="grid grid-cols-2 gap-2">
                {activeCountries.map((country) => (
                  <button
                    key={country.country_code}
                    type="button"
                    onClick={() => selectCountry(country)}
                    className="border border-[#eadfd1] bg-[#fffaf2] px-3 py-2 text-left text-sm transition-colors hover:bg-[#f7f1e8] focus:outline-none focus:ring-2 focus:ring-[#d1842c]"
                    aria-label={`${country.country} 선택, 지원 도시 ${country.city_count}개`}
                  >
                    <span className="block font-semibold">{country.country}</span>
                    <span className="text-xs text-[#756c60]">지원 도시 {country.city_count}개</span>
                  </button>
                ))}
              </div>
            )}

            {activeCountry && (
              <div className="space-y-2">
                <div className="bg-[#f7f1e8] px-3 py-2 text-sm font-semibold text-[#1D1D1F]">
                  {activeCountry.country} · 지원 도시 {activeCountry.city_count}개
                </div>
                {activeCities.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => selectCity(city)}
                    className={`flex w-full items-center justify-between border px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#d1842c] ${
                      selectedCityId === city.id
                        ? "border-[#d1842c] bg-[#f1e2cc]"
                        : "border-[#eadfd1] bg-white hover:bg-[#f7f1e8]"
                    }`}
                    aria-label={selectedCityId === city.id ? `${city.city} 선택 해제` : `${city.city} 선택`}
                  >
                    <span>
                      <span className="font-semibold">{city.city_kr}</span>
                      <span className="ml-1 text-xs text-[#756c60]">{city.city}</span>
                    </span>
                    <span className="text-xs font-semibold text-[#d1842c]">{city.country_code}</span>
                  </button>
                ))}
                <div className="border-t border-[#eadfd1] pt-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-normal text-[#756c60]">Secret City</p>
                  <div className="flex gap-2">
                    <input
                      value={unsupportedQuery}
                      onChange={(event) => setUnsupportedQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void searchUnsupportedCity();
                        }
                      }}
                      placeholder="목록에 없는 도시"
                      className="h-10 min-w-0 flex-1 border border-[#d8d0c4] bg-[#fffaf2] px-3 text-sm font-medium text-[#1D1D1F] outline-none placeholder:text-[#756c60] focus:border-[#d1842c]"
                    />
                    <button
                      type="button"
                      onClick={() => void searchUnsupportedCity()}
                      disabled={geocodeLoading || unsupportedQuery.trim().length < 2}
                      className="h-10 border border-[#272225] bg-[#272225] px-3 text-xs font-extrabold text-[#fffaf2] transition-colors hover:bg-[#3a3030] disabled:opacity-40"
                    >
                      {geocodeLoading ? "검색중" : "검색"}
                    </button>
                  </div>
                  {unsupportedResults.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {unsupportedResults.map((result) => (
                        <button
                          key={result.geocode_result_id ?? `${result.city}-${result.lat}-${result.lng}`}
                          type="button"
                          onClick={() => selectUnsupportedCity(result)}
                          className={`w-full border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#d1842c] ${
                            selectedGeocodeResult?.geocode_result_id === result.geocode_result_id
                              ? "border-[#d1842c] bg-[#fff2ba]"
                              : "border-[#eadfd1] bg-white hover:bg-[#f7f1e8]"
                          }`}
                        >
                          <span className="block font-semibold">{result.city}</span>
                          <span className="block truncate text-xs text-[#756c60]">{result.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedLocation && (
              <div className="mt-3 border-t border-[#eadfd1] pt-3">
                <div className="mb-2 flex items-center gap-2 bg-[#f7f1e8] px-3 py-2 text-sm text-[#3d352d]">
                  <MapPin className="size-4 text-[#d1842c]" />
                  <span className="font-semibold">{selectedLocation.city}</span>
                  <span className="text-xs text-[#756c60]">{selectedLocation.country}</span>
                  <span className={`ml-auto px-2 py-1 text-[10px] font-black uppercase ${flagBgClass(pendingFlagColor)}`}>
                    {pendingFlagColor}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={gpsState === "requesting"}
                  className="mb-2 inline-flex h-10 w-full items-center justify-center gap-2 border border-[#272225] bg-[#78bfe0] px-3 text-sm font-extrabold text-[#272225] shadow-[3px_3px_0_#272225] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <LocateFixed className="size-4" />
                  {gpsState === "requesting" ? "GPS 확인 중" : gpsVerified ? "GPS 인증 완료" : "GPS 인증하기"}
                </button>
                {selectedGeocodeResult && !gpsVerified && (
                  <p className="mb-2 text-xs leading-relaxed text-[#756c60]">
                    목록 밖 도시는 현재 위치 인증 후 노란 깃발로 저장됩니다.
                  </p>
                )}

                <input
                  value={note}
                  maxLength={10}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="방명록 10글자"
                  className="mb-2 h-11 w-full border border-[#d8d0c4] bg-[#fffaf2] px-3 text-sm font-medium text-[#1D1D1F] outline-none placeholder:text-[#756c60] focus:border-[#d1842c]"
                />
                <button
                  type="button"
                  onClick={saveStop}
                  disabled={loading || note.length > 10 || Boolean(selectedGeocodeResult && !gpsVerified)}
                  className={`h-11 w-full px-4 text-sm font-semibold text-white transition-colors disabled:opacity-45 ${flagBgClass(pendingFlagColor)}`}
                >
                  {auth.logged_in ? "깃발 꽂기" : "로그인하고 내 log 저장하기"}
                </button>
              </div>
            )}

            {status && <p className="mt-3 text-xs leading-relaxed text-[#756c60]">{status}</p>}
          </div>

          <div className="border border-[#d8d0c4] bg-white p-3">
            <p className="mb-2 text-sm font-semibold text-[#1D1D1F]">내 여정</p>
            {myStops.length === 0 ? (
              <p className="text-xs leading-relaxed text-[#756c60]">{auth.logged_in ? "아직 인증한 도시가 없습니다." : "로그인하면 내 이동선이 저장됩니다."}</p>
            ) : (
              <div className="space-y-2">
                {myStops.map((stop, index) => (
                  <div key={stop.id} className="flex items-center justify-between bg-[#f7f1e8] px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`size-2.5 border border-[#272225] ${flagBgClass(stop.flag_color ?? "red")}`} />
                      {index + 1}. {stop.city}
                    </span>
                    <span className="font-semibold text-[#d1842c]">{stop.note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      </div>
    </div>
  );
}
