import './GenreFilter.css';

export default function GenreFilter({ genres, active, onSelect }) {
  return (
    <div className="genre-filter" role="tablist" aria-label="Filter by genre">
      {genres.map((genre) => (
        <button
          key={genre}
          role="tab"
          aria-selected={active === genre}
          className={`genre-filter__chip ${active === genre ? 'is-active' : ''}`}
          onClick={() => onSelect(genre)}
        >
          {genre}
        </button>
      ))}
    </div>
  );
}
