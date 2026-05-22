"use client";

// Multi-select cuisine chips. Selected cuisines submit as repeated
// `cuisine` form fields to the savePreferences action.

import { useState } from "react";

import { Button, Chip } from "@/components/brand";

import { savePreferences } from "./actions";

export function PreferencesForm({
  options,
  selected,
}: {
  options: string[];
  selected: string[];
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set(selected));

  const toggle = (c: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  return (
    <form action={savePreferences} className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {options.map((c) => (
          <Chip
            key={c}
            type="button"
            active={picked.has(c)}
            onClick={() => toggle(c)}
          >
            {c}
          </Chip>
        ))}
      </div>

      {[...picked].map((c) => (
        <input key={c} type="hidden" name="cuisine" value={c} />
      ))}

      <Button type="submit" size="lg" className="w-full">
        Save preferences
      </Button>
    </form>
  );
}
