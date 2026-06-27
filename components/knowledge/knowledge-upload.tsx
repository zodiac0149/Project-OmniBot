"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { CheckCircle2, FileText, FileUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type UploadResult = {
  sourceName: string;
  chunksStored: number;
  documentType: "stable" | "latest_only";
  documentCategory: "general" | "policy_terms_warranty" | "volatile";
  stableUploadMode: "append" | "replace";
  replacedExistingChunks: number;
  sourceUpdatedAt: string;
};

type BrandOption = {
  id: string;
  name: string;
};

type KnowledgeUploadProps = {
  brands: BrandOption[];
};

export function KnowledgeUpload({ brands }: KnowledgeUploadProps) {
  const [brandId, setBrandId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<"auto" | "stable" | "latest_only">("auto");
  const [documentCategory, setDocumentCategory] = useState<"general" | "policy_terms_warranty">("general");
  const [stableUploadMode, setStableUploadMode] = useState<"append" | "replace">("append");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!brandId && brands.length > 0) {
      setBrandId(brands[0].id);
      return;
    }

    if (!brandId) {
      try {
        const sessionText = localStorage.getItem("nexusai.session");
        const session = sessionText ? JSON.parse(sessionText) : null;
        const metadataBrandId = session?.brandId ?? session?.organizationId;

        if (typeof metadataBrandId === "string") {
          setBrandId(metadataBrandId);
        }
      } catch {
        setBrandId("");
      }
    }
  }, [brands, brandId]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setResult(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError("Choose a PDF, TXT, or Markdown file first.");
      return;
    }

    if (!brandId) {
      setError("Missing brand id. Select a brand before uploading.");
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("brandId", brandId);
    formData.append("documentType", documentType);
    formData.append("documentCategory", documentCategory);
    formData.append("stableUploadMode", stableUploadMode);

    const response = await fetch("/api/knowledge/upload", {
      method: "POST",
      body: formData
    });

    const payload = await response.json();
    setIsLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to upload knowledge source.");
      return;
    }

    setResult(payload);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="brandId">
          Brand
        </label>
        {brands.length > 0 ? (
          <select
            id="brandId"
            value={brandId}
            onChange={(event) => setBrandId(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id="brandId"
            value={brandId}
            onChange={(event) => setBrandId(event.target.value)}
            placeholder="Paste a brand UUID"
          />
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="documentType">
          Document freshness
        </label>
        <select
          id="documentType"
          value={documentType}
          onChange={(event) => {
            const nextType =
              event.target.value === "latest_only" ? "latest_only" : event.target.value === "stable" ? "stable" : "auto";
            setDocumentType(nextType);
            if (nextType !== "stable") {
              setDocumentCategory("general");
              setStableUploadMode("append");
            }
          }}
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="auto">Auto-detect freshness</option>
          <option value="stable">Stable terms, warranty, service, FAQ</option>
          <option value="latest_only">Latest-only prices, new cars, inventory</option>
        </select>
      </div>

      {documentType === "stable" ? (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="documentCategory">
              Stable document category
            </label>
            <select
              id="documentCategory"
              value={documentCategory}
              onChange={(event) =>
                setDocumentCategory(event.target.value === "policy_terms_warranty" ? "policy_terms_warranty" : "general")
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="general">Additive stable docs, FAQ, service notes</option>
              <option value="policy_terms_warranty">Policy, terms, warranty</option>
            </select>
          </div>

          {documentCategory === "policy_terms_warranty" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="stableUploadMode">
                Policy update behavior
              </label>
              <select
                id="stableUploadMode"
                value={stableUploadMode}
                onChange={(event) => setStableUploadMode(event.target.value === "replace" ? "replace" : "append")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="append">Add alongside existing policy docs</option>
                <option value="replace">Replace previous policy docs</option>
              </select>
            </div>
          ) : null}
        </>
      ) : null}

      <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-muted/40 p-6 text-center transition-colors hover:bg-muted/70">
        <FileUp className="mb-3 h-8 w-8 text-primary" />
        <span className="font-medium">{file ? file.name : "Upload brand knowledge"}</span>
        <span className="mt-1 text-sm text-muted-foreground">PDF, TXT, or Markdown up to 8MB</span>
        <input className="sr-only" type="file" accept=".pdf,.txt,.md,text/plain,application/pdf" onChange={handleFileChange} />
      </label>

      {file ? (
        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{file.name}</span>
        </div>
      ) : null}

      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {result ? (
        <p className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Stored {result.chunksStored} {result.documentType === "latest_only" ? "latest-only" : "stable"} chunks from {result.sourceName}.
          {result.replacedExistingChunks > 0
            ? ` Removed ${result.replacedExistingChunks} older ${result.documentType === "latest_only" ? "latest-only" : "policy"} chunks first.`
            : ""}
        </p>
      ) : null}

      <Button className="w-full" type="submit" disabled={isLoading}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
        {isLoading ? "Embedding document..." : "Upload and embed"}
      </Button>
    </form>
  );
}
