import React, { useMemo, useState } from "react";
import "./BookTagCloud.css";

export default function BookTagCloud({
  tags = [
    { id: "fiction", label: "Fiction", count: 28 },
    { id: "mystery", label: "Mystery", count: 21 },
    { id: "fantasy", label: "Fantasy", count: 18 },
    { id: "history", label: "History", count: 14 },
    { id: "romance", label: "Romance", count: 12 },
    { id: "science", label: "Science", count: 10 },
    { id: "psychology", label: "Psychology", count: 8 },
    { id: "biography", label: "Biography", count: 6 }
  ],
  value,
  defaultValue = [],
  onChange,
  title = "Book topics",
  subtitle = "Explore the themes and genres in your collection.",
  variant = "blue",
  interactive = true,
  showCounts = true,
  maxTags
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selected = value !== undefined ? value : internalValue;

  const visibleTags = useMemo(
    () => maxTags ? tags.slice(0, maxTags) : tags,
    [tags, maxTags]
  );

  const toggleTag = (tag) => {
    const next = selected.includes(tag.id)
      ? selected.filter((id) => id !== tag.id)
      : [...selected, tag.id];

    if (value === undefined) setInternalValue(next);
    onChange?.(next, tag);
  };

  const clearTags = () => {
    if (value === undefined) setInternalValue([]);
    onChange?.([], null);
  };

  return (
    <section
      className={`book-tag-cloud book-tag-cloud--${variant}`}
      aria-label="Book tag cloud"
    >
      <header className="book-tag-cloud__header">
        <div>
          <p className="book-tag-cloud__eyebrow">Collection tags</p>
          <h3 className="book-tag-cloud__title">{title}</h3>
          <p className="book-tag-cloud__subtitle">{subtitle}</p>
        </div>

        {interactive && selected.length > 0 && (
          <button
            type="button"
            className="book-tag-cloud__clear"
            onClick={clearTags}
          >
            Clear
          </button>
        )}
      </header>

      <div className="book-tag-cloud__tags" aria-label="Book tags">
        {visibleTags.map((tag) => {
          const isSelected = selected.includes(tag.id);
          const size = Math.max(0.85, Math.min(1.25, 0.85 + (tag.count || 0) / 100));

          const className = [
            "book-tag-cloud__tag",
            isSelected && "book-tag-cloud__tag--selected",
            !interactive && "book-tag-cloud__tag--static"
          ].filter(Boolean).join(" ");

          return interactive ? (
            <button
              key={tag.id}
              type="button"
              className={className}
              aria-pressed={isSelected}
              onClick={() => toggleTag(tag)}
              style={{ "--tag-scale": size }}
            >
              <span>{tag.label}</span>
              {showCounts && <small>{tag.count}</small>}
            </button>
          ) : (
            <span
              key={tag.id}
              className={className}
              style={{ "--tag-scale": size }}
            >
              <span>{tag.label}</span>
              {showCounts && <small>{tag.count}</small>}
            </span>
          );
        })}
      </div>

      {selected.length > 0 && (
        <p className="book-tag-cloud__selection">
          {selected.length} {selected.length === 1 ? "tag" : "tags"} selected
        </p>
      )}
    </section>
  );
}
