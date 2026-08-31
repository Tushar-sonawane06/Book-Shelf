import React from "react";
import "./DailyReadingPrompt.css";

export default function DailyReadingPrompt({
  prompt = "Read for 20 minutes today and discover one idea worth remembering.",
  title = "Today's reading prompt",
  eyebrow = "Daily reading",
  icon = "💡",
  author = "Reading habit",
  variant = "blue",
  compact = false,
  actionLabel = "Start reading",
  onAction
}) {
  return (
    <section
      className={[
        "daily-reading-prompt",
        `daily-reading-prompt--${variant}`,
        compact && "daily-reading-prompt--compact"
      ].filter(Boolean).join(" ")}
      aria-label="Daily reading prompt"
    >
      <div className="daily-reading-prompt__icon" aria-hidden="true">
        {icon}
      </div>

      <div className="daily-reading-prompt__body">
        <p className="daily-reading-prompt__eyebrow">{eyebrow}</p>
        <h3 className="daily-reading-prompt__title">{title}</h3>
        <blockquote className="daily-reading-prompt__quote">
          “{prompt}”
        </blockquote>

        {author && (
          <p className="daily-reading-prompt__author">
            — {author}
          </p>
        )}

        {onAction && (
          <button
            type="button"
            className="daily-reading-prompt__button"
            onClick={onAction}
          >
            {actionLabel}
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </section>
  );
}
