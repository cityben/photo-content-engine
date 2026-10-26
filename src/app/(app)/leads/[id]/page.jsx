import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, MapPin, Phone, Star } from "lucide-react";

import { PageHeader } from "@/components/shell/app-shell";
import { getLead, LEAD_STAGES } from "@/lib/leads";

import { LeadDetail } from "./lead-detail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const lead = await getLead((await params).id).catch(() => null);
  return { title: `${lead?.name || "Lead"} — Content Engine` };
}

export default async function LeadPage({ params }) {
  const lead = await getLead((await params).id);
  if (!lead) notFound();
  return (
    <>
      <Link href="/leads" className="-mb-4 inline-flex w-fit items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="size-4" /> Leads
      </Link>
      <PageHeader title={lead.name} description={[lead.category, lead.fit != null && `fit ${lead.fit}/100`].filter(Boolean).join(" · ")} />
      <div className="-mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-700">
        {lead.address && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-gray-500" /> {lead.address}
          </span>
        )}
        {lead.phone && (
          <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-primary">
            <Phone className="size-4 text-gray-500" /> {lead.phone}
          </a>
        )}
        {lead.website && (
          <a href={lead.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary">
            <Globe className="size-4 text-gray-500" /> {lead.domain || lead.website}
          </a>
        )}
        {lead.rating != null && (
          <span className="inline-flex items-center gap-1.5">
            <Star className="size-4 fill-amber-400 text-amber-500" aria-hidden /> {lead.rating.toFixed(1)} from {lead.reviews} Google reviews
          </span>
        )}
      </div>
      <LeadDetail initialLead={lead} stages={LEAD_STAGES} aiReady={Boolean(process.env.VERCEL || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN)} />
    </>
  );
}
