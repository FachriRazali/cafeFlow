"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { CafeTable, Floor, TableShape as TableShapeType, ZoneType } from "@/lib/types";
import { BuilderTableNode } from "./BuilderTableNode";
import { Building2, Check, DoorOpen, Flame, Loader2, Plus, RotateCw, Trash2, TreePine } from "@/components/ui/icons";

const ZONE_ICON: Record<ZoneType, typeof DoorOpen> = { indoor: DoorOpen, outdoor: TreePine, smoking: Flame };
const SHAPE_DEFAULTS: Record<TableShapeType, { width: number; height: number; capacity: number }> = {
  round: { width: 84, height: 84, capacity: 4 },
  square: { width: 84, height: 84, capacity: 2 },
  rectangle: { width: 130, height: 70, capacity: 6 },
  sofa: { width: 110, height: 70, capacity: 4 },
  bar: { width: 60, height: 100, capacity: 1 }
};

let tempId = -1;

export function FloorPlanBuilder({ initialFloors, cafeId }: { initialFloors: Floor[]; cafeId: number }) {
  const [floors, setFloors] = useState<Floor[]>(initialFloors);
  const [activeFloorId, setActiveFloorId] = useState(initialFloors[0]?.id);
  const [activeLevel, setActiveLevel] = useState(initialFloors[0]?.level ?? 1);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [creatingZone, setCreatingZone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null);

  const levels = useMemo(() => [...new Set(floors.map((f) => f.level))].sort((a, b) => a - b), [floors]);
  const floorsOnLevel = useMemo(() => floors.filter((f) => f.level === activeLevel), [floors, activeLevel]);
  const activeFloor = floors.find((f) => f.id === activeFloorId) ?? floorsOnLevel[0] ?? floors[0];
  const selectedTable = activeFloor?.tables.find((t) => t.id === selectedTableId) ?? null;

  function selectLevel(level: number) {
    setActiveLevel(level);
    const firstOnLevel = floors.find((f) => f.level === level);
    if (firstOnLevel) setActiveFloorId(firstOnLevel.id);
    setSelectedTableId(null);
  }

  function updateFloor(floorId: number, updater: (f: Floor) => Floor) {
    setFloors((prev) => prev.map((f) => (f.id === floorId ? updater(f) : f)));
  }

  function addTable(shape: TableShapeType) {
    if (!activeFloor) return;
    const defaults = SHAPE_DEFAULTS[shape];
    const code = `T${activeFloor.tables.length + 1}`;
    const newTable: CafeTable = {
      id: tempId--,
      floorId: activeFloor.id,
      cafeId,
      tableCode: code,
      shape,
      x: 40 + ((activeFloor.tables.length * 24) % 300),
      y: 40 + ((activeFloor.tables.length * 18) % 200),
      width: defaults.width,
      height: defaults.height,
      rotation: 0,
      capacity: defaults.capacity,
      status: "available",
      currentReservationId: null
    };
    updateFloor(activeFloor.id, (f) => ({ ...f, tables: [...f.tables, newTable] }));
    setSelectedTableId(newTable.id);
  }

  async function addZone(zone: ZoneType, level: number = activeLevel) {
    setCreatingZone(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/merchant/floors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cafeId,
          name: `${zone[0].toUpperCase()}${zone.slice(1)} Zone`,
          zoneType: zone,
          level
        })
      });
      if (!res.ok) throw new Error("Could not create this zone. Please try again.");
      const newFloor: Floor = await res.json();
      setFloors((prev) => [...prev, newFloor]);
      setActiveLevel(newFloor.level);
      setActiveFloorId(newFloor.id);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Could not create this zone.");
    } finally {
      setCreatingZone(false);
    }
  }

  function addLevel() {
    const nextLevel = (levels.at(-1) ?? 0) + 1;
    addZone("indoor", nextLevel);
  }

  function onPointerDown(e: React.PointerEvent, table: CafeTable) {
    e.stopPropagation();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    dragState.current = {
      id: table.id,
      offsetX: e.clientX - canvasRect.left - table.x,
      offsetY: e.clientY - canvasRect.top - table.y
    };
    setSelectedTableId(table.id);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onPointerMove(e: PointerEvent) {
    const drag = dragState.current;
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!drag || !canvasRect || !activeFloor) return;
    const x = Math.max(0, Math.min(activeFloor.canvasWidth - 40, e.clientX - canvasRect.left - drag.offsetX));
    const y = Math.max(0, Math.min(activeFloor.canvasHeight - 40, e.clientY - canvasRect.top - drag.offsetY));
    updateFloor(activeFloor.id, (f) => ({
      ...f,
      tables: f.tables.map((t) => (t.id === drag.id ? { ...t, x, y } : t))
    }));
  }

  function onPointerUp() {
    dragState.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }

  function patchSelected(patch: Partial<CafeTable>) {
    if (!activeFloor || !selectedTable) return;
    updateFloor(activeFloor.id, (f) => ({
      ...f,
      tables: f.tables.map((t) => (t.id === selectedTable.id ? { ...t, ...patch } : t))
    }));
  }

  function deleteSelected() {
    if (!activeFloor || !selectedTable) return;
    updateFloor(activeFloor.id, (f) => ({ ...f, tables: f.tables.filter((t) => t.id !== selectedTable.id) }));
    setSelectedTableId(null);
  }

  async function saveLayout() {
    if (!activeFloor) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/merchant/floors/${activeFloor.id}/layout`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tables: activeFloor.tables.map((t) => ({
            tableCode: t.tableCode,
            shape: t.shape,
            x: t.x,
            y: t.y,
            width: t.width,
            height: t.height,
            rotation: t.rotation,
            capacity: t.capacity
          }))
        })
      });
      if (!res.ok) throw new Error("Could not save this layout. Please try again.");
      setSavedAt(new Date());
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Could not save this layout.");
    } finally {
      setSaving(false);
    }
  }

  // A cafe super_admin just created has zero floors — show the "add your
  // first level" prompt instead of rendering nothing, so there's always a
  // way to bootstrap a brand-new cafe's seating plan from this page.
  if (!activeFloor) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
        <div>
          {errorMsg && (
            <div className="mb-4 rounded-xl border border-capacity-red/30 bg-capacity-redBg px-3 py-2 text-xs font-semibold text-capacity-red">
              {errorMsg}
            </div>
          )}
          <Panel title="Building floor">
            <p className="mb-3 text-sm text-ink-400">This cafe has no floor/zone yet. Add the first one to start the seating plan.</p>
            <button
              onClick={addLevel}
              disabled={creatingZone}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-200 py-2 text-xs font-semibold text-ink-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-50"
            >
              {creatingZone ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add floor level
            </button>
          </Panel>
        </div>
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-ink-200 text-sm text-ink-400">
          Add a floor level on the left to start placing tables.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr_260px]">
      {/* Left: levels + zones + palette */}
      <div className="space-y-4">
        {errorMsg && (
          <div className="rounded-xl border border-capacity-red/30 bg-capacity-redBg px-3 py-2 text-xs font-semibold text-capacity-red">
            {errorMsg}
          </div>
        )}

        <Panel title="Building floor">
          <div className="space-y-1.5">
            {levels.map((level) => (
              <button
                key={level}
                onClick={() => selectLevel(level)}
                className={clsx(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition",
                  level === activeLevel ? "bg-brand-600 text-white" : "bg-ink-50 text-ink-700 hover:bg-ink-100"
                )}
              >
                <Building2 size={14} /> Lantai {level}
              </button>
            ))}
          </div>
          <button
            onClick={addLevel}
            disabled={creatingZone}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-200 py-2 text-xs font-semibold text-ink-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-50"
          >
            {creatingZone ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add floor level
          </button>
        </Panel>

        <Panel title="Zones">
          <div className="space-y-1.5">
            {floorsOnLevel.map((f) => {
              const Icon = ZONE_ICON[f.zoneType];
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setActiveFloorId(f.id);
                    setSelectedTableId(null);
                  }}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition",
                    f.id === activeFloorId ? "bg-ink-900 text-white" : "bg-ink-50 text-ink-700 hover:bg-ink-100"
                  )}
                >
                  <Icon size={14} /> {f.name}
                  <span className="ml-auto text-xs opacity-70">{f.tables.length}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {(["indoor", "outdoor", "smoking"] as ZoneType[]).map((z) => {
              const Icon = ZONE_ICON[z];
              return (
                <button
                  key={z}
                  onClick={() => addZone(z)}
                  disabled={creatingZone}
                  className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-ink-200 py-2 text-[10px] font-semibold text-ink-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-50"
                >
                  <Icon size={14} /> +{z}
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title="Add table">
          <div className="space-y-2">
            {(["round", "square", "rectangle"] as TableShapeType[]).map((shape) => (
              <button
                key={shape}
                onClick={() => addTable(shape)}
                className="flex w-full items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-sm font-semibold text-ink-700 hover:border-brand-400 hover:bg-brand-50"
              >
                <span className="capitalize">{shape} table</span>
                <Plus size={14} />
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {/* Center: canvas */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-ink-900">
              Lantai {activeFloor.level} · {activeFloor.name}
            </h3>
            <p className="text-xs text-ink-400">Drag tables to reposition. Click to edit properties.</p>
          </div>
          <button
            onClick={saveLayout}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {saving ? "Saving…" : savedAt ? "Saved ✓ Save again" : "Save layout"}
          </button>
        </div>

        <div
          ref={canvasRef}
          onPointerDown={() => setSelectedTableId(null)}
          className="relative overflow-hidden rounded-2xl border border-dashed border-ink-200 bg-[linear-gradient(to_right,#eceef2_1px,transparent_1px),linear-gradient(to_bottom,#eceef2_1px,transparent_1px)] bg-surface"
          style={{ width: "100%", height: activeFloor.canvasHeight, maxWidth: activeFloor.canvasWidth, backgroundSize: "20px 20px" }}
        >
          {activeFloor.tables.map((t) => (
            <BuilderTableNode
              key={t.id}
              table={t}
              selected={t.id === selectedTableId}
              onPointerDown={onPointerDown}
              onClick={(t) => setSelectedTableId(t.id)}
            />
          ))}
          {activeFloor.tables.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-400">
              This zone is empty — add a table from the left panel.
            </p>
          )}
        </div>
        {savedAt && (
          <p className="mt-2 text-xs text-capacity-green">
            Layout saved as JSON at {savedAt.toLocaleTimeString()} — persisted to floors[{activeFloor.id}].tables
          </p>
        )}
      </div>

      {/* Right: properties */}
      <div>
        <Panel title="Table properties">
          {selectedTable ? (
            <div className="space-y-3">
              <LabeledField label="Table code">
                <input
                  value={selectedTable.tableCode}
                  onChange={(e) => patchSelected({ tableCode: e.target.value })}
                  className="w-full rounded-lg border border-ink-100 px-2.5 py-1.5 text-sm font-semibold"
                />
              </LabeledField>
              <LabeledField label="Capacity">
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={selectedTable.capacity}
                  onChange={(e) => patchSelected({ capacity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-ink-100 px-2.5 py-1.5 text-sm font-semibold"
                />
              </LabeledField>
              <LabeledField label="Shape">
                <select
                  value={selectedTable.shape}
                  onChange={(e) => patchSelected({ shape: e.target.value as TableShapeType })}
                  className="w-full rounded-lg border border-ink-100 px-2.5 py-1.5 text-sm font-semibold capitalize"
                >
                  {(["round", "square", "rectangle"] as TableShapeType[]).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </LabeledField>
              <LabeledField label={`Rotation: ${selectedTable.rotation}°`}>
                <div className="flex items-center gap-2">
                  <RotateCw size={14} className="text-ink-400" />
                  <input
                    type="range"
                    min={0}
                    max={359}
                    value={selectedTable.rotation}
                    onChange={(e) => patchSelected({ rotation: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </LabeledField>
              <button
                onClick={deleteSelected}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-capacity-red/30 py-2 text-sm font-semibold text-capacity-red hover:bg-capacity-redBg"
              >
                <Trash2 size={14} /> Remove table
              </button>
            </div>
          ) : (
            <p className="text-sm text-ink-400">Select a table on the canvas to edit its properties, or add a new one.</p>
          )}
        </Panel>

        <Panel title="JSON preview">
          <pre className="max-h-56 overflow-auto rounded-lg bg-ink-900 p-2.5 text-[10px] leading-relaxed text-brand-200">
            {JSON.stringify(
              activeFloor.tables.map((t) => ({ code: t.tableCode, shape: t.shape, x: Math.round(t.x), y: Math.round(t.y), capacity: t.capacity })),
              null,
              2
            )}
          </pre>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ink-900/5">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-400">{title}</h4>
      {children}
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-600">{label}</span>
      {children}
    </label>
  );
}
