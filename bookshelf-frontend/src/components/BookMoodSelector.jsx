import React, { useState } from "react";
import "./BookMoodSelector.css";

export default function BookMoodSelector({
  moods = [
    { id: "relaxed", label: "Relaxed", emoji: "😌" },
    { id: "inspired", label: "Inspired", emoji: "✨" },
    { id: "excited", label: "Excited", emoji: "🤩" },
    { id: "emotional", label: "Emotional", emoji: "🥹" },
    { id: "curious", label: "Curious", emoji: "🤔" },
    { id: "focused", label: "Focused", emoji: "🎯" }
  ],
  value,
  defaultValue,
  onChange,
  title = "How does this book make you feel?",
  subtitle = "Choose the mood that best matches your reading experience.",
  variant = "blue",
  layout = "grid",
  compact = false
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? null);
  const selectedMood = value !== undefined ? value : internalValue;

  const selectMood = (mood) => {
    if (value === undefined) setInternalValue(mood.id);
    onChange?.(mood.id, mood);
  };

  return (
    <section className={[
      "book-mood-selector",
      `book-mood-selector--${variant}`,
      `book-mood-selector--${layout}`,
      compact && "book-mood-selector--compact"
    ].filter(Boolean).join(" ")}>
      <div className="book-mood-selector__header">
        <div>
          <p className="book-mood-selector__eyebrow">Reading mood</p>
          <h3 className="book-mood-selector__title">{title}</h3>
          <p className="book-mood-selector__subtitle">{subtitle}</p>
        </div>
        {selectedMood && (
          <span className="book-mood-selector__selected">
            {moods.find(m => m.id === selectedMood)?.label ?? "Selected"}
          </span>
        )}
      </div>

      <div className="book-mood-selector__options" role="radiogroup" aria-label="Choose a reading mood">
        {moods.map(mood => {
          const selected = selectedMood === mood.id;
          return (
            <button
              key={mood.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={[
                "book-mood-selector__option",
                selected && "book-mood-selector__option--selected"
              ].filter(Boolean).join(" ")}
              onClick={() => selectMood(mood)}
            >
              <span className="book-mood-selector__emoji" aria-hidden="true">{mood.emoji}</span>
              <span className="book-mood-selector__label">{mood.label}</span>
              {selected && <span className="book-mood-selector__check" aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
