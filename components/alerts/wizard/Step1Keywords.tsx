"use client";

import { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Props {
  keywords: string[];
  onChange: (keywords: string[]) => void;
}

export default function Step1Keywords({ keywords, onChange }: Props) {
  const [inputValue, setInputValue] = useState("");

  function addKeyword(raw: string) {
    const trimmed = raw.trim().replace(/,+$/, "").trim();
    if (!trimmed || keywords.includes(trimmed)) return;
    onChange([...keywords, trimmed]);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword(inputValue);
      setInputValue("");
    }
  }

  function handleChange(value: string) {
    if (value.endsWith(",")) {
      addKeyword(value);
      setInputValue("");
    } else {
      setInputValue(value);
    }
  }

  function removeKeyword(kw: string) {
    onChange(keywords.filter((k) => k !== kw));
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">What are you looking for?</h2>
      <p className="text-sm text-gray-500 mb-4">
        Add keywords to search for — press Enter or comma to add each one.
      </p>

      <Input
        placeholder="e.g. iPhone 14, MacBook Pro"
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
      />

      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {keywords.map((kw) => (
            <Badge key={kw} variant="secondary" className="flex items-center gap-1 pr-1">
              {kw}
              <button
                type="button"
                onClick={() => removeKeyword(kw)}
                className="ml-1 rounded-full hover:bg-gray-300 h-4 w-4 flex items-center justify-center text-xs leading-none"
                aria-label={`Remove ${kw}`}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}

      {keywords.length === 0 && (
        <p className="text-xs text-gray-400 mt-2">Add at least one keyword to continue.</p>
      )}
    </div>
  );
}
