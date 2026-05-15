"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Step1Keywords from "./Step1Keywords";
import Step2Filters from "./Step2Filters";
import Step3Schedule from "./Step3Schedule";

export type WizardData = {
  keywords: string[];
  location: string;
  radiusMiles: number;
  minPrice: string;
  maxPrice: string;
  conditions: string[];
  name: string;
  frequency: "daily" | "weekly";
};

const initialData: WizardData = {
  keywords: [],
  location: "",
  radiusMiles: 25,
  minPrice: "",
  maxPrice: "",
  conditions: [],
  name: "",
  frequency: "daily",
};

export default function WizardShell() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStep1Valid = data.keywords.length > 0;
  const isStep2Valid = data.location.trim().length > 0;
  const isStep3Valid = data.name.trim().length > 0;

  const canContinue =
    step === 1 ? isStep1Valid : step === 2 ? isStep2Valid : isStep3Valid;

  function advanceToStep3() {
    setData((d) => ({ ...d, name: d.name || d.keywords[0] || "" }));
    setStep(3);
  }

  function handleContinue() {
    if (step === 2) {
      advanceToStep3();
    } else {
      setStep((s) => s + 1);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          keywords: data.keywords,
          location: data.location,
          radiusMiles: data.radiusMiles,
          minPrice: data.minPrice ? Number(data.minPrice) : null,
          maxPrice: data.maxPrice ? Number(data.maxPrice) : null,
          conditions: data.conditions,
          frequency: data.frequency,
        }),
      });
      if (res.status === 403) {
        setError("UPGRADE_REQUIRED");
        return;
      }
      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        return;
      }
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <p className="text-sm text-gray-400 mb-1 font-medium">Step {step} of 3</p>
      <div className="w-full h-1 bg-gray-100 rounded mb-8">
        <div
          className="h-1 bg-black rounded transition-all"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      <div className="mb-8">
        {step === 1 && (
          <Step1Keywords
            keywords={data.keywords}
            onChange={(keywords) => setData((d) => ({ ...d, keywords }))}
          />
        )}
        {step === 2 && (
          <Step2Filters
            data={data}
            onChange={(patch) => setData((d) => ({ ...d, ...patch }))}
          />
        )}
        {step === 3 && (
          <Step3Schedule
            data={data}
            onChange={(patch) => setData((d) => ({ ...d, ...patch }))}
          />
        )}
      </div>

      {error === "UPGRADE_REQUIRED" && (
        <p className="text-red-500 text-sm mb-4">
          You&apos;ve reached the 3-alert free plan limit. Upgrade to Pro to create more alerts.
        </p>
      )}
      {error && error !== "UPGRADE_REQUIRED" && (
        <p className="text-red-500 text-sm mb-4">{error}</p>
      )}

      <div className="flex justify-between items-center">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          className={step === 1 ? "invisible" : ""}
        >
          Back
        </Button>

        {step < 3 ? (
          <Button onClick={handleContinue} disabled={!canContinue}>
            Continue
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!canContinue || loading}>
            {loading ? "Creating…" : "Create Alert"}
          </Button>
        )}
      </div>
    </div>
  );
}
