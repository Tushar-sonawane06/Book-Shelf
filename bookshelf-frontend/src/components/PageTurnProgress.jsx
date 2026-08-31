import React from "react";
import "./PageTurnProgress.css";

export default function PageTurnProgress({
  currentPage = 128,
  totalPages = 320,
  title = "Reading progress",
  showPages = true,
  showPercentage = true,
  showRemaining = true,
  variant = "blue",
  size = "md",
  compact = false
}) {
  const safeTotal = Math.max(Number(totalPages) || 1, 1);
  const safeCurrent = Math.max(0, Math.min(Number(currentPage) || 0, safeTotal));
  const percentage = Math.round((safeCurrent / safeTotal) * 100);
  const remaining = Math.max(safeTotal - safeCurrent, 0);

  return (
    <section
      className={[
        "page-turn-progress",
        `page-turn-progress--${variant}`,
        `page-turn-progress--${size}`,
        compact && "page-turn-progress--compact"
      ].filter(Boolean).join(" ")}
      aria-label="Page turn progress"
      aria-valuemin="0"
      aria-valuemax={safeTotal}
      aria-valuenow={safeCurrent}
      role="progressbar"
    >
      <div className="page-turn-progress__header">
        <div className="page-turn-progress__heading">
          <span className="page-turn-progress__icon" aria-hidden="true">📖</span>
          <div>
            <p className="page-turn-progress__eyebrow">Page turns</p>
            <h3 className="page-turn-progress__title">{title}</h3>
          </div>
        </div>

        {showPercentage && (
          <strong className="page-turn-progress__percentage">
            {percentage}%
          </strong>
        )}
      </div>

      <div className="page-turn-progress__track" aria-hidden="true">
        <span
          className="page-turn-progress__fill"
          style={{ "--page-progress": `${percentage}%` }}
        />
          <span
            className="page-turn-progress__thumb"
            style={{ "--page-progress": `${percentage}%` }}
          />
      </div>

      <div className="page-turn-progress__footer">
        {showPages && (
          <span>
            <strong>{safeCurrent}</strong> / {safeTotal} pages
          </span>
        )}

        {showRemaining && (
          <span>
            <strong>{remaining}</strong> remaining
          </span>
        )}
      </div>
    </section>
  );
}
