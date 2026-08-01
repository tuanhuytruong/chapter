import React, { useEffect, useId, useRef, useState } from 'react';

export type ChapterDropdownOption<T extends string> = {
  value: T;
  label: string;
};

type ChapterDropdownProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly ChapterDropdownOption<T>[];
  label?: string;
  id?: string;
  className?: string;
};

export default function ChapterDropdown<T extends string>({ value, onChange, options, label, id, className = '' }: ChapterDropdownProps<T>) {
  const generatedId = useId();
  const listboxId = id || `chapter-dropdown-${generatedId.replace(/:/g, '')}`;
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(() => Math.max(0, options.findIndex(option => option.value === value)));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selected = options.find(option => option.value === value) || options[0];

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    const index = options.findIndex(option => option.value === value);
    if (index >= 0) setHighlighted(index);
  }, [options, value]);

  const choose = (option: ChapterDropdownOption<T>) => {
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : highlighted + (event.key === 'ArrowDown' ? 1 : -1);
      setHighlighted(Math.min(options.length - 1, Math.max(0, next)));
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && open) { event.preventDefault(); choose(options[highlighted]); }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(true); }
  };

  return <div ref={rootRef} className={`relative ${className}`}>
    {label && <label htmlFor={listboxId} className="text-[11px] font-bold uppercase tracking-wider text-natural-stone">{label}</label>}
    <button ref={buttonRef} id={listboxId} type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${listboxId}-listbox`} aria-activedescendant={open ? `${listboxId}-option-${highlighted}` : undefined} onClick={() => setOpen(current => !current)} onKeyDown={onKeyDown}
      className="mt-1 flex min-h-11 w-full items-center justify-between rounded-xl border border-natural-border bg-natural-cream/50 px-3 py-1.5 text-left text-xs text-natural-dark transition focus:outline-none focus:ring-2 focus:ring-natural-sage">
      <span>{selected?.label}</span><span aria-hidden="true" className={`ml-2 text-natural-stone transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
    </button>
    {open && <ul id={`${listboxId}-listbox`} role="listbox" aria-label={label} className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-natural-border bg-natural-cream p-1 shadow-lg">
      {options.map((option, index) => <li key={option.value} id={`${listboxId}-option-${index}`} role="option" aria-selected={option.value === value} onMouseEnter={() => setHighlighted(index)} onClick={() => choose(option)} className={`cursor-pointer rounded-lg px-3 py-2 text-xs text-natural-dark ${index === highlighted ? 'bg-natural-sage/15' : ''} ${option.value === value ? 'font-bold' : ''}`}>{option.label}</li>)}
    </ul>}
  </div>;
}
