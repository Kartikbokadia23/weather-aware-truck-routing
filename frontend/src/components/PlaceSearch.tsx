import { MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { geocode } from "../lib/api";
import { shortPlace } from "../lib/format";
import type { Place } from "../types";

type Props = {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
};

export function PlaceSearch({ label, placeholder, value, onChange }: Props) {
  const id = useId();
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (value || query.trim().length < 3) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await geocode(query, controller.signal));
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, value]);

  function clear() {
    setQuery("");
    setResults([]);
    onChange(null);
  }

  return (
    <div className="relative">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="field-shell">
        <Search aria-hidden="true" size={17} />
        <input
          id={id}
          value={value ? shortPlace(value.label) : query}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          onChange={(event) => { onChange(null); setQuery(event.target.value); }}
        />
        {loading && <span className="spinner" aria-label="Searching" />}
        {(value || query) && !loading && (
          <button type="button" className="icon-button" onClick={clear} aria-label={`Clear ${label.toLowerCase()}`}><X size={15} /></button>
        )}
      </div>
      {focused && results.length > 0 && (
        <ul className="place-menu" role="listbox" aria-label={`${label} suggestions`}>
          {results.map((place) => (
            <li key={place.id}>
              <button type="button" onClick={() => { onChange(place); setQuery(place.label); setResults([]); }}>
                <MapPin size={16} aria-hidden="true" /><span>{place.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

