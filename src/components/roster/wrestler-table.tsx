"use client";

import { useState } from "react";
import Link from "next/link";
import type { Database } from "@/types/database";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { WrestlerForm } from "./wrestler-form";

type Wrestler = Database["public"]["Tables"]["wrestlers"]["Row"];

export function WrestlerTable({ wrestlers }: { wrestlers: Wrestler[] }) {
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">(
    "all"
  );
  const [showForm, setShowForm] = useState(false);

  const filtered = wrestlers.filter((w) => {
    const matchesSearch = w.name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesGender =
      genderFilter === "all" || w.gender === genderFilter;
    return matchesSearch && matchesGender;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs flex-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <Input
            placeholder="Search wrestlers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background/50"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "male", "female"] as const).map((g) => (
            <Button
              key={g}
              variant={genderFilter === g ? "default" : "outline"}
              size="sm"
              onClick={() => setGenderFilter(g)}
              className={`text-xs ${genderFilter !== g ? "border-border/40 text-muted-foreground hover:text-foreground" : ""}`}
            >
              {g === "all" ? "All" : g === "male" ? "Male" : "Female"}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          className="ml-auto bg-gold text-black hover:bg-gold-dark font-semibold text-xs gap-1.5"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? (
            "Cancel"
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Wrestler
            </>
          )}
        </Button>
      </div>

      {showForm && (
        <div className="animate-slide-down">
          <WrestlerForm onSuccess={() => setShowForm(false)} />
        </div>
      )}

      <div className="rounded-lg border border-border/40 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/40">
              <TableHead className="text-[11px] uppercase tracking-wider">Name</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Gender</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Brand</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Overall</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((wrestler) => (
              <TableRow key={wrestler.id} className="table-row-hover border-border/30">
                <TableCell>
                  <Link
                    href={`/roster/${wrestler.id}`}
                    className="font-medium hover:text-gold transition-colors"
                  >
                    {wrestler.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      wrestler.gender === "male"
                        ? "border-blue-500/20 text-blue-400"
                        : "border-purple-500/20 text-purple-400"
                    }`}
                  >
                    {wrestler.gender === "male" ? "Male" : "Female"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {wrestler.brand || <span className="text-muted-foreground/30">—</span>}
                </TableCell>
                <TableCell className="tabular-nums font-medium">
                  {wrestler.overall_rating ?? <span className="text-muted-foreground/30">—</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className={`status-dot ${wrestler.is_active ? "status-dot-active" : "status-dot-inactive"}`} />
                    <span className="text-xs text-muted-foreground">
                      {wrestler.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No wrestlers found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground/60">
        Showing {filtered.length} of {wrestlers.length}
      </p>
    </div>
  );
}
