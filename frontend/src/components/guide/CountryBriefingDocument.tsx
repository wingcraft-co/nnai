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

function SectionBlock({ section, depth = 0 }: { section: BriefingSection; depth?: number }) {
  const isTopLevel = depth === 0;
  const headingFontSize = isTopLevel ? "22px" : depth === 1 ? "16px" : "14px";
  const headingMarginTop = isTopLevel ? "40px" : "22px";
  const headingFontWeight = isTopLevel ? 600 : 600;

  return (
    <section style={{ marginTop: headingMarginTop }}>
      <h2
        style={{
          fontFamily: SERIF,
          fontSize: headingFontSize,
          fontWeight: headingFontWeight,
          color: COLOR_INK,
          margin: 0,
          paddingBottom: isTopLevel ? "12px" : "6px",
          borderBottom: isTopLevel ? `1px solid ${COLOR_RULE}` : "none",
          display: "flex",
          alignItems: "baseline",
          gap: "14px",
          wordBreak: "keep-all",
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 500,
            color: COLOR_MUTED,
            fontSize: isTopLevel ? "16px" : "13px",
            letterSpacing: "0.04em",
          }}
        >
          {section.num}.
        </span>
        <span>{section.title}</span>
      </h2>

      {section.body && (
        <p
          style={{
            fontFamily: SANS,
            fontSize: "13px",
            lineHeight: 1.75,
            color: COLOR_INK,
            margin: "14px 0 0",
            textAlign: "justify",
            wordBreak: "keep-all",
            overflowWrap: "break-word",
          }}
        >
          {section.body}
        </p>
      )}

      {section.items && section.items.length > 0 && (
        <ul
          style={{
            margin: "12px 0 0",
            paddingLeft: 0,
            listStyle: "none",
            fontFamily: SANS,
            fontSize: "13px",
            lineHeight: 1.75,
            color: COLOR_INK,
          }}
        >
          {section.items.map((item, i) => (
            <li
              key={i}
              style={{
                paddingLeft: "20px",
                position: "relative",
                marginBottom: "6px",
                wordBreak: "keep-all",
                overflowWrap: "break-word",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 4,
                  top: 0,
                  color: COLOR_MUTED,
                }}
              >
                ·
              </span>
              {item}
            </li>
          ))}
        </ul>
      )}

      {section.table && (
        <div style={{ marginTop: "14px" }}>
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
                {section.table.headers.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: i === 0 ? "left" : i === 1 ? "right" : "left",
                      padding: "8px 12px",
                      borderBottom: `1px solid ${COLOR_RULE}`,
                      borderTop: `1px solid ${COLOR_RULE}`,
                      fontWeight: 600,
                      fontSize: "11px",
                      letterSpacing: "0.12em",
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
              {section.table.rows.map((row, ri) => {
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
                            ? `1px solid ${COLOR_RULE}`
                            : "1px dashed rgba(0,0,0,0.12)",
                          fontWeight: isTotal ? 600 : 400,
                          fontSize: "13px",
                          color: ci === 2 ? COLOR_MUTED : COLOR_INK,
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
          {section.table.sourceLabel && (
            <p
              style={{
                fontFamily: SANS,
                fontSize: "11px",
                color: COLOR_MUTED,
                margin: "8px 0 0",
                fontStyle: "italic",
              }}
            >
              {section.table.sourceLabel}
            </p>
          )}
        </div>
      )}

      {section.subsections?.map((sub) => (
        <SectionBlock key={sub.num} section={sub} depth={depth + 1} />
      ))}
    </section>
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
  const titleHeading = data.cityKr ? `${data.cityName} 정착 가이드` : `${data.cityName} Settlement Briefing`;

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

        {/* Appendix */}
        <hr
          style={{
            margin: "48px 0 0",
            border: 0,
            borderTop: `2px solid ${COLOR_RULE}`,
          }}
        />
        <section style={{ marginTop: "24px" }}>
          <h2
            style={{
              fontFamily: SERIF,
              fontSize: "16px",
              fontWeight: 600,
              color: COLOR_INK,
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            Appendix A — References
          </h2>
          <ol
            style={{
              margin: "12px 0 0",
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
                  paddingLeft: "28px",
                  position: "relative",
                  marginBottom: "4px",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    fontWeight: 600,
                    color: COLOR_STAMP,
                    width: "20px",
                  }}
                >
                  <sup style={{ fontSize: "11px" }}>{r.num}</sup>
                </span>
                {r.source}
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
