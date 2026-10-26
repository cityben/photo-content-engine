"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { ArrowRight, GripVertical, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { formatNumber, money } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

const selectClass = "h-9 w-full rounded-md bg-gray-100 px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring";

function byScore(a, b) {
  return (b.score ?? -1) - (a.score ?? -1) || (b.order ?? 0) - (a.order ?? 0);
}

function IdeaCard(props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.idea.id, data: { idea: props.idea } });
  return <IdeaCardView {...props} nodeRef={setNodeRef} handle={{ ...attributes, ...listeners }} isDragging={isDragging} />;
}

function IdeaCardView({ idea, job, stages, formats, sources, onEdit, onMove, overlay, nodeRef, handle, isDragging }) {
  const index = stages.findIndex((s) => s.id === idea.status);
  const next = stages[index + 1];
  return (
    <article
      ref={nodeRef}
      className={cn("flex flex-col gap-2 rounded-lg bg-white p-3 shadow-paper", isDragging && "opacity-30", overlay && "rotate-1 shadow-lg")}
      aria-label={idea.title}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...handle}
          aria-label={`Drag ${idea.title} to another stage`}
          className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-gray-400 outline-none hover:text-gray-700 focus-visible:ring-[3px] focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-5 text-gray-900">{idea.title}</h3>
      </div>
      {idea.keyword && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
          <span className="rounded bg-primary-soft px-1.5 py-0.5 font-medium text-primary">{idea.keyword}</span>
          {idea.volume != null && <span className="tabular-nums">{formatNumber(idea.volume)}/mo</span>}
          {idea.score != null && <span className="tabular-nums">· score {idea.score}</span>}
        </p>
      )}
      {idea.angle && <p className="line-clamp-3 text-xs leading-5 text-gray-600">{idea.angle}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{formats[idea.format] || idea.format}</Badge>
        <Badge variant={idea.source === "ai" ? "default" : "secondary"} title={idea.sourceDetail || undefined}>
          {sources[idea.source] || idea.source}
        </Badge>
        {idea.dueDate && <span className="text-xs tabular-nums text-gray-500">due {new Date(idea.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
      </div>
      {!overlay && (
        <div className="flex flex-wrap items-center gap-1 pt-1">
          {job ? (
            <Button size="sm" variant="ghost" asChild className="h-7 px-2 text-xs">
              <Link href={`/jobs/${job.id}`}>Open job</Link>
            </Button>
          ) : (
            idea.status !== "published" && (
              <Button size="sm" variant="ghost" asChild className="h-7 px-2 text-xs">
                <Link href={`/jobs/new?idea=${idea.id}`}>Start a job</Link>
              </Button>
            )
          )}
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onEdit(idea)} aria-label={`Edit ${idea.title}`}>
            <Pencil /> Edit
          </Button>
          {next && (
            <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={() => onMove(idea, next.id)} aria-label={`Move ${idea.title} to ${next.label}`}>
              {next.label} <ArrowRight />
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

function Column({ stage, children, count }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section ref={setNodeRef} aria-labelledby={`col-${stage.id}`} className={cn("flex min-h-48 min-w-0 flex-col gap-3 rounded-xl bg-gray-100/80 p-3 transition-colors", isOver && "bg-primary-soft")}>
      <h2 id={`col-${stage.id}`} className="flex items-center justify-between px-1 text-sm font-semibold text-gray-900">
        {stage.label} <span className="rounded-full bg-white px-2 text-xs font-medium tabular-nums text-gray-600">{count}</span>
      </h2>
      {children}
    </section>
  );
}

function QuickAdd({ formats, onAdded }) {
  const [title, setTitle] = useState("");
  const [keyword, setKeyword] = useState("");
  const [format, setFormat] = useState("case-study");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-2 rounded-lg bg-white p-3 shadow-paper"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const { idea, duplicate } = await api("/api/ideas", { method: "POST", body: { title, keyword: keyword || null, format, source: "team" } });
          if (duplicate) toast.info("That keyword is already in the pipeline.");
          else onAdded(idea);
          setTitle("");
          setKeyword("");
        } catch (err) {
          toast.error(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Label htmlFor="idea-title" className="sr-only">
        New idea
      </Label>
      <Input id="idea-title" placeholder="New idea, e.g. Daikin VRV retrofit in a live office" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
      <Input aria-label="Target keyword (optional)" placeholder="Target keyword (optional)" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="h-9" />
      <div className="flex gap-2">
        <select aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value)} className={selectClass}>
          {Object.entries(formats).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" className="h-9 shrink-0" aria-label="Add idea" disabled={busy || title.trim().length < 3}>
          {busy ? <Loader2 className="animate-spin" /> : <Plus />} Add
        </Button>
      </div>
    </form>
  );
}

function EditDialog({ idea, stages, formats, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(() => ({ ...idea, keyword: idea.keyword || "", dueDate: idea.dueDate || "", angle: idea.angle || "", notes: idea.notes || "" }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    setBusy(true);
    try {
      const { idea: saved } = await api(`/api/ideas/${idea.id}`, {
        method: "PATCH",
        body: { title: form.title, keyword: form.keyword || null, angle: form.angle, format: form.format, status: form.status, dueDate: form.dueDate || null, notes: form.notes },
      });
      onSaved(saved);
      toast.success("Saved.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete “${idea.title}”? A job made from it is kept.`)) return;
    setBusy(true);
    try {
      await api(`/api/ideas/${idea.id}`, { method: "DELETE" });
      onDeleted(idea);
    } catch (e) {
      toast.error(e.message);
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit idea</DialogTitle>
          <DialogDescription>{idea.sourceDetail || "Ideas are internal notes — nothing here is published."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="e-title">Title</Label>
            <Input id="e-title" value={form.title} onChange={set("title")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="e-angle">Angle</Label>
            <Textarea id="e-angle" rows={3} value={form.angle} onChange={set("angle")} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="e-keyword">Target keyword</Label>
              <Input id="e-keyword" value={form.keyword} onChange={set("keyword")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-due">Due</Label>
              <Input id="e-due" type="date" value={form.dueDate} onChange={set("dueDate")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-format">Format</Label>
              <select id="e-format" value={form.format} onChange={set("format")} className={selectClass}>
                {Object.entries(formats).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-status">Stage</Label>
              <select id="e-status" value={form.status} onChange={set("status")} className={selectClass}>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="e-notes">Notes</Label>
            <Textarea id="e-notes" rows={3} value={form.notes} onChange={set("notes")} placeholder="Which job, who's on it, photos needed…" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={remove} disabled={busy} className="text-destructive">
            <Trash2 /> Delete
          </Button>
          <Button onClick={save} disabled={busy || form.title.trim().length < 3}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Board({ initialIdeas, jobs, stages, formats, sources, aiReady }) {
  const [ideas, setIdeas] = useState(initialIdeas);
  const [editing, setEditing] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [format, setFormat] = useState("all");
  const [source, setSource] = useState("all");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const visible = useMemo(() => ideas.filter((i) => (format === "all" || i.format === format) && (source === "all" || i.source === source)), [ideas, format, source]);

  const replace = (idea) => setIdeas((list) => list.map((i) => (i.id === idea.id ? idea : i)));

  const move = async (idea, status) => {
    if (idea.status === status) return;
    const before = idea.status;
    replace({ ...idea, status });
    try {
      const { idea: saved } = await api(`/api/ideas/${idea.id}`, { method: "PATCH", body: { status } });
      replace(saved);
      const label = stages.find((s) => s.id === status)?.label;
      toast.success(`Moved to ${label}.`, {
        action: {
          label: "Undo",
          onClick: async () => {
            replace({ ...saved, status: before });
            try {
              replace((await api(`/api/ideas/${idea.id}`, { method: "PATCH", body: { status: before } })).idea);
            } catch (e) {
              toast.error(e.message);
            }
          },
        },
      });
    } catch (e) {
      replace(idea);
      toast.error(e.message);
    }
  };

  const plan = async () => {
    setPlanning(true);
    try {
      const r = await api("/api/ideas/plan", { method: "POST" });
      const { ideas: fresh } = await api("/api/ideas");
      setIdeas(fresh);
      toast.success(`${r.added} new ${r.added === 1 ? "idea" : "ideas"} from ${r.suggested} suggestions${r.run?.costUsd != null ? ` · ${money(r.run.costUsd, 3)}` : ""}.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPlanning(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Button onClick={plan} disabled={planning || !aiReady} title={aiReady ? "Uses your keyword, competitor, AI-question and Search Console data" : "Connect the AI Gateway first"}>
          {planning ? <Loader2 className="animate-spin" /> : <Sparkles />} {planning ? "Planning…" : "Suggest ideas"}
        </Button>
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-format" className="text-xs">
            Format
          </Label>
          <select id="f-format" value={format} onChange={(e) => setFormat(e.target.value)} className={cn(selectClass, "w-44 bg-white shadow-paper")}>
            <option value="all">All formats</option>
            {Object.entries(formats).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-source" className="text-xs">
            Source
          </Label>
          <select id="f-source" value={source} onChange={(e) => setSource(e.target.value)} className={cn(selectClass, "w-44 bg-white shadow-paper")}>
            <option value="all">All sources</option>
            {Object.entries(sources).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <p className="ml-auto text-xs text-gray-500">Drag a card by its handle, or use the arrow button to move it on.</p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={({ active }) => setDragging(active.data.current.idea)}
        onDragCancel={() => setDragging(null)}
        onDragEnd={({ active, over }) => {
          setDragging(null);
          if (over) move(active.data.current.idea, over.id);
        }}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stages.map((stage) => {
            const cards = visible.filter((i) => i.status === stage.id).sort(byScore);
            return (
              <Column key={stage.id} stage={stage} count={cards.length}>
                {stage.id === "idea" && <QuickAdd formats={formats} onAdded={(idea) => setIdeas((list) => [idea, ...list])} />}
                {cards.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} job={idea.jobId && jobs[idea.jobId] ? { id: idea.jobId } : null} stages={stages} formats={formats} sources={sources} onEdit={setEditing} onMove={move} />
                ))}
                {!cards.length && stage.id !== "idea" && <p className="px-1 text-xs text-gray-500">Nothing here yet.</p>}
              </Column>
            );
          })}
        </div>
        <DragOverlay dropAnimation={null}>{dragging && <IdeaCardView idea={dragging} stages={stages} formats={formats} sources={sources} overlay />}</DragOverlay>
      </DndContext>

      {editing && (
        <EditDialog
          key={editing.id}
          idea={editing}
          stages={stages}
          formats={formats}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            replace(saved);
            setEditing(null);
          }}
          onDeleted={(gone) => {
            setIdeas((list) => list.filter((i) => i.id !== gone.id));
            setEditing(null);
            toast.success("Deleted.");
          }}
        />
      )}
    </div>
  );
}
