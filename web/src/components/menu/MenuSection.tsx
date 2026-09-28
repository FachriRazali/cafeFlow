"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MenuItem } from "@/lib/types";
import {
  Check,
  FileText,
  ImageIcon,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UtensilsCrossed
} from "@/components/ui/icons";

interface Props {
  cafeId: number;
  menuDocumentUrl?: string;
  menuDocumentType?: "pdf" | "image";
}

export function MenuSection({ cafeId, menuDocumentUrl, menuDocumentType }: Props) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [docUrl, setDocUrl] = useState(menuDocumentUrl);
  const [docType, setDocType] = useState(menuDocumentType);
  const [uploading, setUploading] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [draft, setDraft] = useState({ name: "", price: "", category: "Food", description: "" });

  useEffect(() => {
    // Staff mode now comes from a real login (see /login), not a client-side
    // PIN — the session cookie is sent automatically with these requests.
    // A cashier/admin account is scoped to exactly one cafe, so edit
    // controls only show up when it's *this* cafe — otherwise the API
    // would just 403 on every write anyway.
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        const user = d.user;
        const isCafeStaff = (user?.role === "cashier" || user?.role === "admin") && user?.cafeId === cafeId;
        setIsStaff(isCafeStaff);
      });
  }, [cafeId]);

  useEffect(() => {
    fetch(`/api/cafes/${cafeId}/menu`)
      .then((r) => r.json())
      .then((d) => setItems(d.data))
      .finally(() => setLoading(false));
  }, [cafeId]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of items) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return [...map.entries()];
  }, [items]);

  async function addItem() {
    if (!draft.name || !draft.price) return;
    const res = await fetch(`/api/cafes/${cafeId}/menu`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.name, price: Number(draft.price), category: draft.category, description: draft.description })
    });
    if (res.ok) {
      const item: MenuItem = await res.json();
      setItems((prev) => [...prev, item]);
      setDraft({ name: "", price: "", category: draft.category, description: "" });
      setAddingItem(false);
    }
  }

  async function toggleAvailable(item: MenuItem) {
    const res = await fetch(`/api/cafes/${cafeId}/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !item.isAvailable })
    });
    if (res.ok) setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i)));
  }

  async function removeItem(item: MenuItem) {
    const res = await fetch(`/api/cafes/${cafeId}/menu/${item.id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  async function uploadDocument(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/cafes/${cafeId}/menu-document`, { method: "POST", body: form });
    setUploading(false);
    if (res.ok) {
      const d = await res.json();
      setDocUrl(d.menuDocumentUrl);
      setDocType(d.menuDocumentType);
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900">
          <UtensilsCrossed size={18} /> Menu
        </h2>
        {isStaff ? (
          <span className="flex items-center gap-1.5 rounded-full bg-capacity-greenBg px-3 py-1.5 text-xs font-bold text-capacity-green">
            <Check size={13} /> Staff mode
          </span>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-200"
          >
            <Lock size={13} /> Cashier/admin login
          </Link>
        )}
      </div>

      <div className="rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ink-900/5 sm:p-6">
        {loading ? (
          <p className="text-sm text-ink-400">Loading menu…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-400">No menu items yet.</p>
        ) : (
          <div className="space-y-5">
            {grouped.map(([category, categoryItems]) => (
              <div key={category}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">{category}</h3>
                <div className="space-y-2">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between rounded-xl border border-ink-100 px-3 py-2.5 ${
                        item.isAvailable ? "" : "opacity-50"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink-900">
                          {item.name} {!item.isAvailable && <span className="text-xs font-normal text-ink-400">(sold out)</span>}
                        </p>
                        {item.description && <p className="text-xs text-ink-400">{item.description}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-ink-900">{formatIDR(item.price)}</span>
                        {isStaff && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleAvailable(item)}
                              title="Toggle availability"
                              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => removeItem(item)}
                              title="Remove item"
                              className="rounded-lg p-1.5 text-ink-400 hover:bg-capacity-redBg hover:text-capacity-red"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {isStaff && (
          <div className="mt-4 border-t border-dashed border-ink-100 pt-4">
            {addingItem ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Item name"
                    className="rounded-lg border border-ink-100 px-3 py-2 text-sm"
                  />
                  <input
                    value={draft.price}
                    onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                    placeholder="Price (IDR)"
                    type="number"
                    className="rounded-lg border border-ink-100 px-3 py-2 text-sm"
                  />
                </div>
                <input
                  value={draft.category}
                  onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                  placeholder="Category (e.g. Coffee, Food)"
                  className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm"
                />
                <input
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Description (optional)"
                  className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button onClick={addItem} className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-bold text-white hover:bg-brand-700">
                    Save item
                  </button>
                  <button onClick={() => setAddingItem(false)} className="rounded-lg border border-ink-100 px-4 py-2 text-sm font-semibold text-ink-600">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingItem(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-200 py-2 text-sm font-semibold text-ink-500 hover:border-brand-400 hover:text-brand-600"
              >
                <Plus size={14} /> Add menu item
              </button>
            )}
          </div>
        )}
      </div>

      {/* Menu PDF / image, accessible to everyone */}
      <div className="mt-4 rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ink-900/5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink-900">
            <FileText size={16} /> Full menu (PDF / photo)
          </h3>
          {isStaff && (
            <label className="flex cursor-pointer items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-200">
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? "Uploading…" : "Upload"}
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0])}
              />
            </label>
          )}
        </div>

        {!docUrl ? (
          <p className="text-sm text-ink-400">No menu document uploaded yet.</p>
        ) : docType === "pdf" ? (
          <iframe src={docUrl} className="h-[70vh] w-full rounded-xl border border-ink-100" title="Cafe menu PDF" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={docUrl} alt="Cafe menu" className="w-full rounded-xl border border-ink-100 object-contain" />
        )}
        {!docUrl && !isStaff && (
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-400">
            <ImageIcon size={12} /> Cashier/admin can add one after signing in.
          </p>
        )}
      </div>
    </div>
  );
}

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}
