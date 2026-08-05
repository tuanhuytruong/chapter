import React, { useEffect, useId, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ChevronDown } from "lucide-react";

export type ChapterDropdownOption<T extends string> = {
  value: T;
  label: string;
};

type ChapterDropdownProps<T extends string> = {
  value: T;
  onChange: Dispatch<SetStateAction<T>>;
  options: readonly ChapterDropdownOption<T>[];
  label?: string;
  id?: string;
  className?: string;
  searchable?: boolean;
};

function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function ChapterDropdown<T extends string>({
  value,
  onChange,
  options,
  label,
  id,
  className = "",
  searchable = false,
}: ChapterDropdownProps<T>) {
  const generatedId = useId();
  const listboxId = id || `chapter-dropdown-${generatedId.replace(/:/g, "")}`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(() =>
    Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected =
    options.find((option) => option.value === value) || options[0];
  const normalizedQuery = normalizeSearch(query);
  const visibleOptions =
    searchable && normalizedQuery
      ? options.filter((option) =>
          normalizeSearch(option.label).includes(normalizedQuery),
        )
      : options;

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node))
        close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  });

  useEffect(() => {
    const index = visibleOptions.findIndex((option) => option.value === value);
    setHighlighted(index >= 0 ? index : 0);
  }, [options, value, normalizedQuery]);

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  const choose = (option: ChapterDropdownOption<T>) => {
    onChange(option.value);
    close();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Home" ||
      event.key === "End"
    ) {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (!visibleOptions.length) return;
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? visibleOptions.length - 1
            : highlighted + (event.key === "ArrowDown" ? 1 : -1);
      setHighlighted(Math.min(visibleOptions.length - 1, Math.max(0, next)));
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      if (visibleOptions[highlighted]) choose(visibleOptions[highlighted]);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && (
        <label
          htmlFor={listboxId}
          className="text-[11px] font-bold uppercase tracking-wider text-natural-stone"
        >
          {label}
        </label>
      )}
      <button
        id={listboxId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${listboxId}-listbox`}
        aria-activedescendant={
          open && visibleOptions.length
            ? `${listboxId}-option-${highlighted}`
            : undefined
        }
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onKeyDown}
        className="mt-1 flex min-h-11 w-full items-center justify-between rounded-xl border border-natural-border bg-natural-cream/50 px-3 py-1.5 text-left text-xs text-natural-dark transition focus:outline-none focus:ring-2 focus:ring-natural-sage"
      >
        <span className="min-w-0 truncate">{selected?.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={`ml-2 h-4 w-4 shrink-0 text-natural-stone transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          id={`${listboxId}-listbox`}
          role="listbox"
          aria-label={label}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-xl border border-natural-border bg-natural-cream p-1 shadow-lg"
        >
          {searchable && (
            <li className="sticky top-0 z-10 bg-natural-cream p-1">
              <label htmlFor={`${listboxId}-search`} className="sr-only">
                Search {label?.toLocaleLowerCase() || "options"}
              </label>
              <input
                ref={searchRef}
                id={`${listboxId}-search`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Escape") close();
                }}
                placeholder="Search my books"
                className="min-h-9 w-full rounded-lg border border-natural-border bg-white/70 px-3 text-xs text-natural-dark outline-none focus:border-natural-sage focus:ring-2 focus:ring-natural-sage"
              />
            </li>
          )}
          <div className="max-h-48 overflow-y-auto">
            {visibleOptions.length ? (
              visibleOptions.map((option, index) => (
                <li
                  key={option.value}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => choose(option)}
                  className={`cursor-pointer rounded-lg px-3 py-2 text-xs text-natural-dark ${index === highlighted ? "bg-natural-sage/15" : ""} ${option.value === value ? "font-bold" : ""}`}
                >
                  {option.label}
                  {option.value === value && (
                    <span aria-hidden="true" className="float-right">
                      ✓
                    </span>
                  )}
                </li>
              ))
            ) : (
              <li
                role="presentation"
                className="px-3 py-3 text-xs text-natural-stone"
              >
                No books found
              </li>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
