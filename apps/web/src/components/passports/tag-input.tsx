'use client';

import { Plus, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';

interface TagInputProps {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  onBlur?: () => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}

/** Editable list of short strings (e.g. critical raw materials) with add/remove controls. */
export function TagInput({ id, value, onChange, onBlur, placeholder, invalid, describedBy }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const item = draft.trim();
    if (!item) return;
    if (!value.some((existing) => existing.toLowerCase() === item.toLowerCase())) onChange([...value, item]);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add();
    } else if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          placeholder={placeholder}
          invalid={invalid}
          aria-describedby={describedBy}
        />
        <Button type="button" variant="secondary" onClick={add} disabled={!draft.trim()}>
          <Plus />
          Add
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Added items">
          {value.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-subtle py-0.5 pr-1 pl-2 text-[13px] text-ink"
            >
              {item}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== item))}
                className="rounded p-0.5 text-ink-subtle hover:bg-line hover:text-ink"
                aria-label={`Remove ${item}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
