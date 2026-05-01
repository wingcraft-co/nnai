"use client";

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

// 본문 단락 — 첫 줄 들여쓰기 1em (인쇄 문서 컨벤션)
function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: SANS,
        fontSize: "13px",
        lineHeight: 1.75,
        color: COLOR_INK,
        margin: "10px 0 0",
        textIndent: "16px",
        textAlign: "justify",
        wordBreak: "keep-all",
        overflowWrap: "break-word",
      }}
    >
      {children}
    </p>
  );
}

// 항목 list — baseline hard-lock: marker와 텍스트 같은 폰트/크기/lineHeight
function ItemList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: "10px" }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "22px 1fr",
            columnGap: "6px",
            marginBottom: "5px",
            alignItems: "baseline",
            fontFamily: SANS,
            fontSize: "13px",
            lineHeight: 1.7,
            color: COLOR_INK,
          }}
        >
          <span
            style={{
              fontFamily: SANS,
              fontSize: "13px",
              lineHeight: 1.7,
              fontStyle: "italic",
              fontWeight: 400,
              color: COLOR_MUTED,
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
            {item}
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
          fontFamily: SANS,
          fontSize: "13px",
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
                  padding: "8px 12px",
                  borderBottom: `1px solid ${COLOR_RULE}`,
                  borderTop: `1.5px solid ${COLOR_RULE}`,
                  fontWeight: 600,
                  fontSize: "10px",
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
                      padding: "8px 12px",
                      borderBottom: isTotal
                        ? `1.5px solid ${COLOR_RULE}`
                        : "1px dashed rgba(0,0,0,0.12)",
                      fontWeight: isTotal ? 600 : 400,
                      fontSize: "13px",
                      color: ci === 2 ? COLOR_MUTED : COLOR_INK,
                      fontVariantNumeric: ci === 1 ? "tabular-nums" : "normal",
                      wordBreak: "keep-all",
                    }}
                  >
                    {cell}
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
  // Section (장) — IMF 스타일 bold serif. 가로선 없이 spacing으로만 구분.
  if (depth === 0) {
    return (
      <section style={{ marginTop: "36px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "52px 1fr",
            columnGap: "16px",
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
        <div style={{ paddingLeft: "68px", marginTop: "10px" }}>
          {section.body && <Paragraph>{section.body}</Paragraph>}
          {section.items && <ItemList items={section.items} />}
          {section.table && <BriefingTable table={section.table} />}
          {section.subsections?.map((sub) => (
            <SectionBlock key={sub.num} section={sub} depth={1} />
          ))}
        </div>
      </section>
    );
  }

  // Subsection (절) — IMF 스타일 bold serif. 사이즈만 작게, 가로선 없음.
  return (
    <div style={{ marginTop: "20px" }}>
      <h3
        style={{
          fontFamily: SERIF,
          fontSize: "14px",
          fontWeight: 700,
          color: COLOR_INK,
          margin: 0,
          marginBottom: "4px",
          lineHeight: 1.35,
          wordBreak: "keep-all",
          display: "flex",
          alignItems: "baseline",
          gap: "8px",
        }}
      >
        <span
          style={{
            fontWeight: 500,
            color: COLOR_INK,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {section.num}
        </span>
        <span>{section.title}</span>
      </h3>
      {section.body && <Paragraph>{section.body}</Paragraph>}
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
              fontFamily: SANS,
              fontSize: "12px",
              lineHeight: 1.7,
              color: COLOR_INK,
            }}
          >
            {data.references.map((r) => (
              <li
                key={r.num}
                style={{
                  display: "grid",
                  gridTemplateColumns: "26px 1fr",
                  columnGap: "8px",
                  marginBottom: "8px",
                  alignItems: "baseline",
                  fontFamily: SANS,
                  fontSize: "12px",
                  lineHeight: 1.7,
                }}
              >
                <span
                  style={{
                    fontFamily: SANS,
                    fontSize: "12px",
                    fontWeight: 600,
                    color: COLOR_STAMP,
                    fontVariantNumeric: "tabular-nums",
                    textAlign: "right",
                  }}
                >
                  {r.num}.
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
                  <span style={{ color: COLOR_MUTED, fontSize: "11px" }}>
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
