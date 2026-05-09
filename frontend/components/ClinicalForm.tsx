"use client";

import { useState } from "react";
import type { DiseaseInputField } from "../lib/types";

export function ClinicalForm({
  fields,
  onChange
}: {
  fields: DiseaseInputField[];
  onChange: (values: Record<string, string | number | boolean>) => void;
}) {
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});

  function update(name: string, value: string | number | boolean) {
    const next = { ...values, [name]: value };
    setValues(next);
    onChange(next);
  }

  return (
    <div className="row">
      {fields.map((field) => (
        <div key={field.name} className={field.helpText ? "row full" : undefined}>
          <label className="label">
            {field.label}
            {field.unit ? ` (${field.unit})` : ""}
            {field.required ? " *" : ""}
          </label>

          {field.kind === "boolean" ? (
            <select
              className="select"
              value={String(values[field.name] ?? "false")}
              onChange={(e) => update(field.name, e.target.value === "true")}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          ) : field.kind === "select" ? (
            <select
              className="select"
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
              className="input"
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
              className="input"
              type="text"
              value={String(values[field.name] ?? "")}
              onChange={(e) => update(field.name, e.target.value)}
            />
          )}

          {field.helpText && (
            <div className="subtle" style={{ marginTop: 4 }}>
              {field.helpText}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
