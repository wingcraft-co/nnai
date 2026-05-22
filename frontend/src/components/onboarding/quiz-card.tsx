interface QuizCardProps {
  question: string;
  options: string[];
  onSelect: (answerIndex: number) => void;
  selectedIndex?: number | null;
  disabled?: boolean;
}

export function QuizCard({ question, options, onSelect, selectedIndex = null, disabled = false }: QuizCardProps) {
  return (
    <div className="flex flex-col">
      <h2 className="whitespace-pre-line text-xl font-medium leading-relaxed text-foreground mb-8">
        {question}
      </h2>
      <div className="grid gap-3">
        {options.map((option, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(i)}
            className={`w-full cursor-pointer rounded-lg px-4 py-4 text-left text-sm font-medium transition-colors ${
              selectedIndex === i
                ? "border border-[#d97706] bg-[#d97706] text-white"
                : "bg-muted text-foreground hover:bg-accent"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
