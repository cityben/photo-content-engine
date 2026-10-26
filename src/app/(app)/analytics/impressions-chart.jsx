"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = { linkedin: "#0369a1", instagram: "#e11d48" };

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md bg-white px-3 py-2 text-xs shadow-paper-lg">
      <p className="mb-1 font-medium text-gray-900">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-gray-700">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {Number(p.value).toLocaleString("en-GB")}
        </p>
      ))}
    </div>
  );
}

/** data: [{ day: "12 Oct", linkedin: 1200, instagram: 300 }] */
export function ImpressionsChart({ data, metricLabel }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b7280" }} minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b7280" }} width={48} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
          <Bar dataKey="linkedin" name={`LinkedIn ${metricLabel}`} stackId="a" fill={COLORS.linkedin} radius={[0, 0, 0, 0]} />
          <Bar dataKey="instagram" name={`Instagram ${metricLabel}`} stackId="a" fill={COLORS.instagram} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
