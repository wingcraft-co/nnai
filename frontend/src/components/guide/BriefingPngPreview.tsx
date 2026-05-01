"use client";

import { useEffect, useRef, useState } from "react";
import { CountryBriefingDocument } from "./CountryBriefingDocument";
import type { BriefingData } from "@/lib/briefing-data";

/**
 * 무료 플랜용 — Briefing을 hidden DOM에 렌더 후 PNG로 캡쳐해서 <img>로 표시.
 * 양식 신뢰도는 그대로 유지하되, 이미지 형식이 "복사·편집 잠금" 시그널 역할.
 */
export function BriefingPngPreview({
  data,
  watermark,
}: {
  data: BriefingData;
  watermark: boolean;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function capture() {
      if (!captureRef.current) return;
      try {
        // 폰트 로드 대기 — html-to-image가 폰트 미로딩 상태로 캡쳐하면 fallback 폰트로 그려짐
        if (typeof document !== "undefined" && document.fonts) {
          await document.fonts.ready;
        }
        const { toPng } = await import("html-to-image");
        const url = await toPng(captureRef.current, {
          width: 1080,
          pixelRatio: 2,
          backgroundColor: "#FAF8F4",
          cacheBust: true,
          // ⚠ 캡쳐 root에 적용된 hidden offscreen 스타일을 SVG foreignObject 안에서
          // 무력화. position:absolute + left:-99999px 그대로 두면 clone이
          // 캔버스 밖으로 밀려나 PNG가 빈 background만 남음.
          style: {
            position: "static",
            left: "auto",
            top: "auto",
            transform: "none",
            margin: "0",
            opacity: "1",
            visibility: "visible",
          },
        });
        if (!cancelled) setPngUrl(url);
      } catch (e) {
        if (!cancelled) {
          setError("미리보기 생성에 실패했습니다.");
          console.error("briefing capture failed", e);
        }
      }
    }
    // 다음 frame까지 기다려 layout 안정 후 캡쳐
    const handle = requestAnimationFrame(() => capture());
    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
  }, [data, watermark]);

  return (
    <>
      {/*
        Hidden render for capture — viewport 밖 배치.
        ⚠ opacity:0 / visibility:hidden 사용 금지 — html-to-image는 노드를 clone해서
        SVG foreignObject로 렌더하므로 opacity가 PNG에 그대로 적용되어 투명 결과를 만듦.
        position:absolute + left:-99999px로 시각만 숨기고 layout/style은 정상 유지.
      */}
      <div
        ref={captureRef}
        style={{
          position: "absolute",
          left: "-99999px",
          top: 0,
          pointerEvents: "none",
        }}
        aria-hidden
      >
        <CountryBriefingDocument data={data} watermark={watermark} />
      </div>

      {/* Display */}
      {pngUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pngUrl}
          alt={`${data.cityName} Country Briefing`}
          draggable={false}
          style={{ width: "100%", display: "block", userSelect: "none" }}
        />
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <div className="flex min-h-[480px] items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
          Country Briefing을 생성하는 중...
        </div>
      )}
    </>
  );
}
