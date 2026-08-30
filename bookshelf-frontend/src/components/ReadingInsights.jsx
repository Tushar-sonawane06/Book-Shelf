import React from "react";
import "./ReadingInsights.css";

export default function ReadingInsights({
  stats = [
    { id: "books", label: "Books read", value: "24", detail: "+6 this month", icon: "📚", tone: "blue" },
    { id: "pages", label: "Pages read", value: "4,820", detail: "320 this week", icon: "📖", tone: "green" },
    { id: "minutes", label: "Reading time", value: "68h", detail: "8h 40m this month", icon: "⏱️", tone: "purple" },
    { id: "streak", label: "Best streak", value: "18 days", detail: "Personal best", icon: "🔥", tone: "orange" }
  ],
  title = "Reading insights",
  subtitle = "A quick look at your reading progress and habits.",
  variant = "default",
  compact = false,
  showDetails = true
}) {
  return (
    <section
      className={[
        "reading-insights",
        `reading-insights--${variant}`,
        compact && "reading-insights--compact"
      ].filter(Boolean).join(" ")}
      aria-label="Reading insights"
    >
      <header className="reading-insights__header">
        <div>
          <p className="reading-insights__eyebrow">Your activity</p>
          <h3 className="reading-insights__title">{title}</h3>
          <p className="reading-insights__subtitle">{subtitle}</p>
        </div>
        <span className="reading-insights__badge">This year</span>
      </header>

      <div className="reading-insights__grid">
        {stats.map((stat) => (
          <article
            key={stat.id}
            className={`reading-insights__card reading-insights__card--${stat.tone || "blue"}`}
          >
            <div className="reading-insights__card-top">
              <span className="reading-insights__icon" aria-hidden="true">
                {stat.icon}
              </span>
              {stat.change && (
                <span className="reading-insights__change">{stat.change}</span>
              )}
            </div>

            <p className="reading-insights__label">{stat.label}</p>
            <strong className="reading-insights__value">{stat.value}</strong>

            {showDetails && stat.detail && (
              <span className="reading-insights__detail">{stat.detail}</span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
