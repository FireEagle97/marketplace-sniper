"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WizardData } from "./WizardShell";

const RADIUS_OPTIONS = [5, 10, 25, 50, 100] as const;

const CONDITIONS = [
  { label: "New", value: "new" },
  { label: "Used — Good", value: "used_good" },
  { label: "Used — Fair", value: "used_fair" },
  { label: "For Parts", value: "for_parts" },
] as const;

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

export default function Step2Filters({ data, onChange }: Props) {
  const isAny = data.conditions.length === 0;

  function toggleCondition(value: string) {
    if (data.conditions.includes(value)) {
      const next = data.conditions.filter((c) => c !== value);
      onChange({ conditions: next });
    } else {
      onChange({ conditions: [...data.conditions, value] });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold mb-1">Set your filters</h2>
        <p className="text-sm text-gray-500">Narrow down results by location, price, and condition.</p>
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <Label htmlFor="location">Location <span className="text-red-500">*</span></Label>
        <Input
          id="location"
          placeholder="e.g. San Francisco, CA"
          value={data.location}
          onChange={(e) => onChange({ location: e.target.value })}
          autoFocus
        />
      </div>

      {/* Radius */}
      <div className="space-y-1.5">
        <Label>Search radius</Label>
        <Select
          value={String(data.radiusMiles)}
          onValueChange={(v) => onChange({ radiusMiles: Number(v) })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RADIUS_OPTIONS.map((r) => (
              <SelectItem key={r} value={String(r)}>
                {r} miles
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Price range */}
      <div className="space-y-1.5">
        <Label>Price range (optional)</Label>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min="0"
            placeholder="Min $"
            className="w-28"
            value={data.minPrice}
            onChange={(e) => onChange({ minPrice: e.target.value })}
          />
          <span className="text-gray-400">–</span>
          <Input
            type="number"
            min="0"
            placeholder="Max $"
            className="w-28"
            value={data.maxPrice}
            onChange={(e) => onChange({ maxPrice: e.target.value })}
          />
        </div>
      </div>

      {/* Conditions */}
      <div className="space-y-2">
        <Label>Condition</Label>
        <div className="space-y-2">
          {/* Any */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="cond-any"
              checked={isAny}
              onCheckedChange={() => onChange({ conditions: [] })}
            />
            <Label htmlFor="cond-any" className="font-normal cursor-pointer">
              Any
            </Label>
          </div>
          {/* Specific conditions */}
          {CONDITIONS.map((cond) => (
            <div key={cond.value} className="flex items-center gap-2">
              <Checkbox
                id={`cond-${cond.value}`}
                checked={data.conditions.includes(cond.value)}
                onCheckedChange={() => toggleCondition(cond.value)}
              />
              <Label htmlFor={`cond-${cond.value}`} className="font-normal cursor-pointer">
                {cond.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
