"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import type { WizardData } from "./WizardShell";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  used_good: "Used — Good",
  used_fair: "Used — Fair",
  for_parts: "For Parts",
};

export default function Step3Schedule({ data, onChange }: Props) {
  const conditionsSummary =
    data.conditions.length === 0
      ? "Any"
      : data.conditions.map((c) => CONDITION_LABELS[c] ?? c).join(", ");

  const priceSummary =
    data.minPrice || data.maxPrice
      ? [data.minPrice ? `$${data.minPrice}` : null, data.maxPrice ? `$${data.maxPrice}` : null]
          .filter(Boolean)
          .join(" – ")
      : "Any";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Name &amp; schedule</h2>
        <p className="text-sm text-gray-500">Review your alert settings and choose how often to check.</p>
      </div>

      {/* Alert name */}
      <div className="space-y-1.5">
        <Label htmlFor="alert-name">Alert name</Label>
        <Input
          id="alert-name"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          autoFocus
        />
      </div>

      {/* Frequency */}
      <div className="space-y-2">
        <Label>Check frequency</Label>
        <RadioGroup
          value={data.frequency}
          onValueChange={(v) => onChange({ frequency: v as "daily" | "weekly" })}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="daily" id="freq-daily" />
            <Label htmlFor="freq-daily" className="font-normal cursor-pointer">Daily</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="weekly" id="freq-weekly" />
            <Label htmlFor="freq-weekly" className="font-normal cursor-pointer">Weekly</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
        <p className="font-medium text-gray-700 mb-1">Summary</p>
        <div className="flex flex-wrap gap-1.5">
          {data.keywords.map((kw) => (
            <Badge key={kw} variant="secondary">{kw}</Badge>
          ))}
        </div>
        <p className="text-gray-600">
          <span className="font-medium">Location:</span> {data.location} &middot; {data.radiusMiles} mi radius
        </p>
        <p className="text-gray-600">
          <span className="font-medium">Price:</span> {priceSummary}
        </p>
        <p className="text-gray-600">
          <span className="font-medium">Condition:</span> {conditionsSummary}
        </p>
      </div>
    </div>
  );
}
