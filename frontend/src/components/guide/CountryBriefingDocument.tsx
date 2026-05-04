"use client";

/**
 * Country Briefing — 양식 spec 출처
 *
 * Hierarchy & visual:   Tufte-LaTeX (no horizontal rules; vertical space + small-caps for hierarchy)
 *                       https://github.com/Tufte-LaTeX/tufte-latex
 * Section numbering:    IMF Country Report (1./1.1./1.1.1. 3-level), cover Document №
 *                       https://www.elibrary.imf.org/fileasset/IMF_Editorial_Style_Guide_2024.pdf
 * Tables:               World Bank Editorial Style Guide 2020 — top·bottom horizontal rules only
 *                       (≥1pt), no vertical rules, no row dividers
 *                       https://documents1.worldbank.org/curated/en/318281583390046594/
 * References:           Chicago author-date — issuer · *title* italic · year · url
 *                       (IMF + Chicago Manual 합성)
 *
 * 가로선 정책: zone boundary 4곳에만 (masthead / Quick Facts / 표 top·bottom / footer).
 * Hierarchy 신호로는 절대 사용하지 않음 (Tufte 컨벤션).
 */

import type { BriefingData, BriefingSection } from "@/lib/briefing-data";

const SERIF = "var(--font-briefing-serif), 'Noto Serif KR', Georgia, serif";
const SANS = "var(--font-briefing-sans), system-ui, sans-serif";

const COLOR_BG = "#FAF8F4";
const COLOR_INK = "#1A1A1A";
const COLOR_MUTED = "#5A5A5A";
const COLOR_RULE = "#1A1A1A";
const COLOR_STAMP = "#7B1F1F";
const COLOR_OVERLINE = "#7B1F1F";

const DOC_WIDTH = 1080;
const DOC_PADDING_X = 96;
const DOC_PADDING_Y = 80;

// Hanging-indent num columns — IMF Country Report 컨벤션 (모든 layer leftmost align)
const NUM_COL_SECTION = 40;       // "1."
const NUM_COL_SUBSECTION = 48;    // "1.1"
const NUM_COL_ITEM = 24;          // "(a)"
const COL_GAP = 16;

// 본문 typography — GOV.UK 5px-multiple line-height + IMF body serif
const BODY_FS = "15px";
const BODY_LH = "25px";

// ─────────────────────────────────────────────────────────────────

// 본문 내 [1] [2] 마커 → STAMP color superscript 변환 (References list와 시각 연결)
function renderFootnotes(text: string): React.ReactNode {
  if (!text.includes("[")) return text;
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    if (/^\[\d+\]$/.test(part)) {
      const num = part.slice(1, -1);
      return (
        <span
          key={i}
          style={{
            color: COLOR_STAMP,
            fontWeight: 600,
            fontSize: "0.82em",
            marginLeft: "2px",
            marginRight: "1px",
            letterSpacing: "0.02em",
          }}
        >
          [{num}]
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─────────────────────────────────────────────────────────────────

function BriefingWatermark({ text }: { text: string }) {
  const ROW_COUNT = 24;
  const COL_COUNT = 5;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%) rotate(-30deg)",
          transformOrigin: "center",
          width: "200%",
          height: "200%",
        }}
      >
        {Array.from({ length: ROW_COUNT }).map((_, row) => (
          <div
            key={row}
            style={{
              display: "flex",
              gap: "120px",
              paddingLeft: row % 2 === 0 ? 0 : "200px",
              marginBottom: "70px",
              whiteSpace: "nowrap",
              justifyContent: "flex-start",
            }}
          >
            {Array.from({ length: COL_COUNT }).map((_, col) => (
              <span
                key={col}
                style={{
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: "26px",
                  letterSpacing: "0.22em",
                  color: "rgba(0,0,0,0.07)",
                  textTransform: "uppercase",
                }}
              >
                {text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

function QFCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "16px 18px",
        borderRight: `1px solid ${COLOR_RULE}`,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontFamily: SANS,
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.2em",
          color: COLOR_OVERLINE,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: SERIF,
          fontSize: "18px",
          fontWeight: 600,
          color: COLOR_INK,
          lineHeight: 1.25,
          wordBreak: "keep-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

// 본문 단락 — IMF body serif + 첫 줄 들여쓰기 (인쇄 문서 컨벤션)
function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: SERIF,
        fontSize: BODY_FS,
        lineHeight: BODY_LH,
        color: COLOR_INK,
        margin: "10px 0 0",
        textIndent: "18px",
        textAlign: "justify",
        wordBreak: "keep-all",
        overflowWrap: "break-word",
      }}
    >
      {children}
    </p>
  );
}

// 항목 list — IMF/World Bank 컨벤션: (a) non-italic, body 동색, hanging indent
function ItemList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: "12px" }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: `${NUM_COL_ITEM}px 1fr`,
            columnGap: "8px",
            marginBottom: "6px",
            alignItems: "baseline",
            fontFamily: SERIF,
            fontSize: BODY_FS,
            lineHeight: BODY_LH,
            color: COLOR_INK,
          }}
        >
          <span
            style={{
              fontFamily: SERIF,
              fontSize: BODY_FS,
              lineHeight: BODY_LH,
              fontWeight: 500,
              color: COLOR_INK,
              textAlign: "right",
            }}
          >
            ({String.fromCharCode(97 + (i % 26))})
          </span>
          <span
            style={{
              wordBreak: "keep-all",
              overflowWrap: "break-word",
            }}
          >
            {renderFootnotes(item)}
          </span>
        </div>
      ))}
    </div>
  );
}

// 표 (Cost Profile 등)
function BriefingTable({
  table,
}: {
  table: NonNullable<BriefingSection["table"]>;
}) {
  return (
    <div style={{ marginTop: "16px" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: SERIF,
          fontSize: "14px",
          color: COLOR_INK,
        }}
      >
        <thead>
          <tr>
            {table.headers.map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: i === 0 ? "left" : i === 1 ? "right" : "left",
                  padding: "10px 12px",
                  borderBottom: `1px solid ${COLOR_RULE}`,
                  borderTop: `1.5px solid ${COLOR_RULE}`,
                  fontFamily: SANS,
                  fontWeight: 600,
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  color: COLOR_MUTED,
                  textTransform: "uppercase",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => {
            const isTotal = row[0] === "Total";
            return (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      textAlign: ci === 0 ? "left" : ci === 1 ? "right" : "left",
                      padding: "9px 12px",
                      borderBottom: isTotal
                        ? `1.5px solid ${COLOR_RULE}`
                        : "1px dashed rgba(0,0,0,0.12)",
                      fontFamily: SERIF,
                      fontWeight: isTotal ? 600 : 400,
                      fontSize: "14px",
                      color: ci === 2 ? COLOR_MUTED : COLOR_INK,
                      fontVariantNumeric: ci === 1 ? "tabular-nums" : "normal",
                      wordBreak: "keep-all",
                    }}
                  >
                    {ci === 2 ? renderFootnotes(cell) : cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {table.sourceLabel && (
        <p
          style={{
            fontFamily: SANS,
            fontSize: "11px",
            color: COLOR_MUTED,
            margin: "8px 0 0",
            fontStyle: "italic",
          }}
        >
          {table.sourceLabel}
        </p>
      )}
    </div>
  );
}

function SectionBlock({ section, depth = 0 }: { section: BriefingSection; depth?: number }) {
  // Section (장) — IMF bold serif heading + leftmost body (Tufte: nested indent 최소화)
  if (depth === 0) {
    return (
      <section style={{ marginTop: "40px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${NUM_COL_SECTION}px 1fr`,
            columnGap: `${COL_GAP}px`,
            alignItems: "baseline",
          }}
        >
          <span
            style={{
              fontFamily: SERIF,
              fontSize: "22px",
              fontWeight: 700,
              color: COLOR_INK,
              lineHeight: 1.2,
              fontVariantNumeric: "tabular-nums",
              textAlign: "right",
              letterSpacing: "-0.01em",
            }}
          >
            {section.num}.
          </span>
          <h2
            style={{
              fontFamily: SERIF,
              fontSize: "22px",
              fontWeight: 700,
              color: COLOR_INK,
              margin: 0,
              lineHeight: 1.2,
              wordBreak: "keep-all",
              letterSpacing: "-0.005em",
            }}
          >
            {section.title}
          </h2>
        </div>
        <div style={{ marginTop: "10px" }}>
          {section.body && <Paragraph>{renderFootnotes(section.body)}</Paragraph>}
          {section.items && <ItemList items={section.items} />}
          {section.table && <BriefingTable table={section.table} />}
          {section.subsections?.map((sub) => (
            <SectionBlock key={sub.num} section={sub} depth={1} />
          ))}
        </div>
      </section>
    );
  }

  // Subsection (절) — IMF bold serif italic + hanging indent (장과 동일 grid 컨벤션)
  return (
    <div style={{ marginTop: "26px" }}>
      <h3
        style={{
          display: "grid",
          gridTemplateColumns: `${NUM_COL_SUBSECTION}px 1fr`,
          columnGap: `${COL_GAP}px`,
          alignItems: "baseline",
          margin: 0,
          marginBottom: "6px",
        }}
      >
        <span
          style={{
            fontFamily: SERIF,
            fontSize: "16px",
            fontWeight: 500,
            color: COLOR_INK,
            lineHeight: 1.4,
            fontVariantNumeric: "tabular-nums",
            textAlign: "right",
          }}
        >
          {section.num}
        </span>
        <span
          style={{
            fontFamily: SERIF,
            fontSize: "16px",
            fontWeight: 700,
            fontStyle: "italic",
            color: COLOR_INK,
            lineHeight: 1.4,
            wordBreak: "keep-all",
            letterSpacing: "-0.005em",
          }}
        >
          {section.title}
        </span>
      </h3>
      {section.body && <Paragraph>{renderFootnotes(section.body)}</Paragraph>}
      {section.items && <ItemList items={section.items} />}
      {section.table && <BriefingTable table={section.table} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

export function CountryBriefingDocument({
  data,
  watermark,
}: {
  data: BriefingData;
  watermark: boolean;
}) {
  const titleHeading = data.cityKr
    ? `${data.cityKr} 정착 가이드`
    : `${data.cityName} Settlement Briefing`;

  return (
    <article
      style={{
        width: `${DOC_WIDTH}px`,
        background: COLOR_BG,
        color: COLOR_INK,
        fontFamily: SANS,
        position: "relative",
        overflow: "hidden",
        padding: `${DOC_PADDING_Y}px ${DOC_PADDING_X}px`,
        boxSizing: "border-box",
      }}
    >
      {watermark && <BriefingWatermark text={`WINGCRAFT · NNAI · ${data.issuedDate}`} />}

      <div style={{ position: "relative", zIndex: 2 }}>
        {/* Masthead */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: SANS,
            fontSize: "12px",
            color: COLOR_MUTED,
          }}
        >
          <span style={{ fontWeight: 600, letterSpacing: "0.05em" }}>
            NomadNavigator AI · Wingcraft
          </span>
          <span
            style={{
              padding: "4px 10px",
              border: `1.5px solid ${COLOR_STAMP}`,
              color: COLOR_STAMP,
              fontWeight: 600,
              fontSize: "10px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            {data.classification}
          </span>
        </header>

        <hr
          style={{
            margin: "18px 0 22px",
            border: 0,
            borderTop: `2px solid ${COLOR_RULE}`,
          }}
        />

        {/* Document control */}
        <div style={{ marginBottom: "28px" }}>
          <p
            style={{
              fontFamily: SANS,
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.32em",
              color: COLOR_OVERLINE,
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Country Briefing
          </p>
          <p
            style={{
              fontFamily: SANS,
              fontSize: "12px",
              color: COLOR_MUTED,
              margin: "4px 0 0",
              letterSpacing: "0.04em",
            }}
          >
            Document № {data.documentId}
          </p>
        </div>

        {/* Title */}
        <div style={{ marginBottom: "18px" }}>
          <h1
            style={{
              fontFamily: SERIF,
              fontSize: "38px",
              fontWeight: 700,
              color: COLOR_INK,
              lineHeight: 1.15,
              margin: 0,
              wordBreak: "keep-all",
            }}
          >
            {titleHeading}
          </h1>
          <p
            style={{
              fontFamily: SERIF,
              fontSize: "18px",
              color: COLOR_MUTED,
              margin: "8px 0 0",
              fontStyle: "italic",
            }}
          >
            {data.countryOfficial}
            {data.cityKr ? ` · ${data.cityKr}` : ""}
          </p>
        </div>

        {/* Meta */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: SANS,
            fontSize: "12px",
            color: COLOR_INK,
            marginBottom: "24px",
          }}
        >
          <span>Issued: {data.issuedDate}</span>
          <span>Prepared for: {data.preparedFor}</span>
        </div>

        <hr
          style={{
            margin: "0 0 24px",
            border: 0,
            borderTop: `1px solid ${COLOR_RULE}`,
          }}
        />

        {/* Quick Facts */}
        <div
          style={{
            display: "flex",
            border: `1px solid ${COLOR_RULE}`,
            borderRight: 0,
            background: "#fff",
          }}
        >
          <QFCell label="Visa" value={data.quickFacts.visa} />
          <QFCell label="Stay" value={data.quickFacts.stay} />
          <QFCell label="Monthly" value={data.quickFacts.monthly} />
          <QFCell label="Tax Res." value={data.quickFacts.taxResidency} />
        </div>

        {/* Sections */}
        {data.sections.map((sec) => (
          <SectionBlock key={sec.num} section={sec} />
        ))}

        {/* References — 가로선 없이 큰 spacing으로 구분 */}
        <section style={{ marginTop: "60px" }}>
          <h2
            style={{
              fontFamily: SERIF,
              fontSize: "18px",
              fontWeight: 700,
              color: COLOR_INK,
              margin: 0,
              marginBottom: "12px",
              lineHeight: 1.2,
              letterSpacing: "-0.005em",
            }}
          >
            References
          </h2>
          <ol
            style={{
              margin: "14px 0 0",
              paddingLeft: 0,
              listStyle: "none",
              fontFamily: SERIF,
              fontSize: "13px",
              lineHeight: "22px",
              color: COLOR_INK,
            }}
          >
            {data.references.map((r) => (
              <li
                key={r.num}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr",
                  columnGap: "8px",
                  marginBottom: "10px",
                  alignItems: "baseline",
                  fontFamily: SERIF,
                  fontSize: "13px",
                  lineHeight: "22px",
                }}
              >
                <span
                  style={{
                    fontFamily: SERIF,
                    fontSize: "13px",
                    fontWeight: 600,
                    color: COLOR_STAMP,
                    fontVariantNumeric: "tabular-nums",
                    textAlign: "right",
                  }}
                >
                  [{r.num}]
                </span>
                <span
                  style={{
                    wordBreak: "keep-all",
                    overflowWrap: "break-word",
                  }}
                >
                  {r.issuer}.{" "}
                  <span style={{ fontStyle: "italic" }}>{r.title}</span>
                  {r.year ? `, ${r.year}` : ""}.{" "}
                  <span style={{ color: COLOR_MUTED, fontSize: "12px" }}>
                    ({r.url})
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Footer */}
        <hr
          style={{
            margin: "40px 0 16px",
            border: 0,
            borderTop: `1px solid ${COLOR_RULE}`,
          }}
        />
        <footer
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: SANS,
            fontSize: "10px",
            color: COLOR_MUTED,
            letterSpacing: "0.04em",
          }}
        >
          <span>NomadNavigator AI · {data.classification}</span>
          <span>Document {data.documentId}</span>
        </footer>
      </div>
    </article>
  );
}
