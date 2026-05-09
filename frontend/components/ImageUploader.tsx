"use client";

import { useRef, useState } from "react";

export type ImagePayload = {
  imageBase64: string;
  imageMimeType: string;
  imageByteLength: number;
  fileName: string;
};

export function ImageUploader({
  acceptedMimeTypes,
  onChange
}: {
  acceptedMimeTypes: string[];
  onChange: (p: ImagePayload | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);

  async function handleFile(file: File) {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);
    setFile({ name: file.name, size: file.size });
    onChange({
      imageBase64: b64,
      imageMimeType: file.type,
      imageByteLength: file.size,
      fileName: file.name
    });
  }

  return (
    <div>
      <div
        className={`upload-zone ${file ? "has-file" : ""}`}
        onClick={() => inputRef.current?.click()}
        role="button"
      >
        {file ? (
          <>
            <strong>{file.name}</strong>
            <div className="subtle">
              {(file.size / 1024).toFixed(1)} KB — click to replace
            </div>
          </>
        ) : (
          <>
            <strong>Click to upload an image</strong>
            <div className="subtle">
              Accepted: {acceptedMimeTypes.join(", ")} — synthetic / non-PHI only
            </div>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={acceptedMimeTypes.join(",")}
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {file && (
        <button
          type="button"
          className="btn secondary"
          style={{ marginTop: 8 }}
          onClick={() => {
            setFile(null);
            onChange(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
