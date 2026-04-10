"use client";

import { motion } from "framer-motion";
import type { CityData } from "./types";

interface TarotReadingProps {
  city: CityData;
  markdown: string;
  onCompare: () => void;
}

// Convert minimal markdown (headers, bold, lists) to HTML for display
function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold mt-4 mb-1 text-gray-800">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-5 mb-2 text-gray-900">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-2 text-gray-900">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-gray-700">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-700">$1</li>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="border-gray-200 my-4" />')
    // Paragraphs — blank line separated
    .replace(/\n\n+/g, '</p><p class="mb-3 text-gray-700 leading-relaxed">')
    // Wrap remainder
    .replace(/^(.+)$/, '<p class="mb-3 text-gray-700 leading-relaxed">$1');
}

export default function TarotReading({
  city,
  markdown,
  onCompare,
}: TarotReadingProps) {
  const html = markdownToHtml(markdown);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-xl mx-auto px-4 py-8 flex flex-col gap-6"
    >
      {/* City header */}
      <div
        className="border-l-4 pl-4 py-1"
        style={{ borderColor: "#c9a84c" }}
      >
        <p className="text-xs text-gray-400 mb-0.5">{city.country}</p>
        <h2 className="text-2xl font-bold text-gray-900">{city.city_kr}</h2>
        <p className="text-sm text-gray-500">{city.city}</p>
      </div>

      {/* Reading content */}
      <article
        className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* CTA */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-gray-400 text-center">
          다른 카드도 살펴볼까요?
        </p>
        <button
          type="button"
          onClick={onCompare}
          className="px-8 py-3 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: "linear-gradient(135deg, #c9a84c, #e8c96e)",
            color: "#1a1a2e",
          }}
        >
          도시 비교 보기
        </button>
      </div>
    </motion.div>
  );
}
