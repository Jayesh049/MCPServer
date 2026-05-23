"use client";

import { useState } from "react";
import type { DiseaseInputField } from "../lib/types";

export function ClinicalForm({
  fields,
  onChange,
  variant = "legacy"
}: {
  fields: DiseaseInputField[];
  onChange: (values: Record<string, string | number | boolean>) => void;
  variant?: "legacy" | "stunning";
}) {
  const stunning = variant === "stunning";
  const gridClass = stunning ? "stf-grid" : "row";
  const fullClass = stunning ? "stf-full" : "row full";
  const labelClass = stunning ? "stf-label" : "label";
  const inputClass = stunning ? "stf-input" : "input";
  const selectClass = stunning ? "stf-input" : "select";
  const helpClass = stunning ? "stf-help" : "subtle";
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});

  function update(name: string, value: string | number | boolean) {
    const next = { ...values, [name]: value };
    setValues(next);
    onChange(next);
  }

  return (
    <div className={gridClass}>
      {fields.map((field) => (
        <div key={field.name} className={field.helpText ? fullClass : undefined}>
          <label className={labelClass}>
            {field.label}
            {field.unit ? ` (${field.unit})` : ""}
            {field.required ? " *" : ""}
          </label>

          {field.kind === "boolean" ? (
            <select
              className={selectClass}
              value={String(values[field.name] ?? "false")}
              onChange={(e) => update(field.name, e.target.value === "true")}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          ) : field.kind === "select" ? (
            <select
              className={selectClass}
              value={String(values[field.name] ?? "")}
              onChange={(e) => update(field.name, e.target.value)}
            >
              <option value="">Select…</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : field.kind === "number" ? (
            <input
              className={inputClass}
              type="number"
              min={field.min}
              max={field.max}
              value={String(values[field.name] ?? "")}
              onChange={(e) =>
                update(field.name, e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          ) : (
            <input
              className={inputClass}
              type="text"
              value={String(values[field.name] ?? "")}
              onChange={(e) => update(field.name, e.target.value)}
            />
          )}

          {field.helpText && (
            <div className={helpClass} style={{ marginTop: 4 }}>
              {field.helpText}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
