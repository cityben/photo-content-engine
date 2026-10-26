"use client";

import {
  AlertCircle,
  Briefcase,
  Camera,
  Check,
  CodeXml,
  Copy,
  FileText,
  Hash,
  Images,
  ListOrdered,
  MapPin,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopy } from "@/components/use-copy";
import { wordCount } from "@/lib/formats";
import { cn } from "@/lib/utils";

const ICONS = {
  linkedin: Briefcase,
  instagram: Camera,
  before_after: Images,
  gmb: MapPin,
  blog: FileText,
  schema: CodeXml,
  twitter: ListOrdered,
};

function Hashtags({ tags }) {
  if (!Array.isArray(tags) || !tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

function Prose({ children }) {
  return <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{children}</p>;
}

function Body({ format, data }) {
  if (data.text && Object.keys(data).length === 1 && format !== "schema") {
    return <Prose>{data.text}</Prose>;
  }

  switch (format) {
    case "linkedin":
    case "gmb":
      return (
        <div className="flex flex-col gap-4">
          <Prose>{data.post}</Prose>
          <Hashtags tags={data.hashtags} />
        </div>
      );
    case "instagram":
      return (
        <div className="flex flex-col gap-4">
          <Prose>{data.caption}</Prose>
          <Hashtags tags={data.hashtags} />
        </div>
      );
    case "before_after":
      return (
        <div className="flex flex-col gap-4">
          <Prose>{data.description}</Prose>
          {Array.isArray(data.benefits) && data.benefits.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {data.benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-gray-700">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-marker" />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case "blog":
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold leading-snug text-gray-900">{data.title}</p>
            {data.meta_description && (
              <p className="text-sm text-gray-600">{data.meta_description}</p>
            )}
          </div>
          <ol className="flex flex-col gap-2">
            {(data.sections || []).map((s, i) => (
              <li key={i} className="rounded-md bg-gray-50 px-3 py-2.5">
                <p className="text-sm font-medium text-gray-800">{s.heading}</p>
                {s.description && <p className="mt-0.5 text-sm text-gray-600">{s.description}</p>}
              </li>
            ))}
          </ol>
          <Hashtags tags={data.keywords} />
        </div>
      );
    case "schema": {
      const code =
        data.text && Object.keys(data).length === 1 ? data.text : JSON.stringify(data, null, 2);
      return (
        <pre className="max-h-80 overflow-auto rounded-md bg-gray-50 p-4 font-mono text-xs leading-5 text-gray-700">
          {code}
        </pre>
      );
    }
    case "twitter":
      return (
        <ol className="flex flex-col gap-2">
          {(data.thread || []).map((t, i, all) => {
            const length = t.text?.length || 0;
            return (
              <li key={i} className="rounded-md bg-gray-50 px-3 py-2.5">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {i + 1}/{all.length}
                  </span>
                  <span className={cn(length > 280 && "font-medium text-destructive")}>
                    {length}/280
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{t.text}</p>
              </li>
            );
          })}
        </ol>
      );
    default:
      return <Prose>{JSON.stringify(data, null, 2)}</Prose>;
  }
}

export function ContentCard({ format, data, loading, className }) {
  const { copied, copy } = useCopy();
  const Icon = ICONS[format.key] || Hash;
  const text = data && !data.error ? format.toText(data) : "";
  const words = format.key === "schema" ? null : wordCount(text);

  return (
    <Card className={cn("min-w-0 gap-5", className)}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Icon className="size-[18px]" />
          </span>
          <div className="flex flex-col gap-0.5">
            <CardTitle>{format.label}</CardTitle>
            <CardDescription className="text-xs">
              {data && !data.error && words !== null ? `${words} words` : format.hint}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            disabled={!text}
            onClick={() => copy(text, `${format.label} copied`)}
            aria-label={`Copy ${format.label}`}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2.5" aria-hidden>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ) : data?.error ? (
          <p className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            This format failed to generate: {data.error}
          </p>
        ) : data ? (
          <Body format={format.key} data={data} />
        ) : (
          <p className="rounded-md bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
            Appears here after you generate.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
