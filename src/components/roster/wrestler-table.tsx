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
        <Input
          placeholder="Search wrestlers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-2">
          {(["all", "male", "female"] as const).map((g) => (
            <Button
              key={g}
              variant={genderFilter === g ? "default" : "outline"}
              size="sm"
              onClick={() => setGenderFilter(g)}
            >
              {g === "all" ? "All" : g === "male" ? "Male" : "Female"}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          className="ml-auto"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancel" : "Add Wrestler"}
        </Button>
      </div>

      {showForm && <WrestlerForm onSuccess={() => setShowForm(false)} />}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Overall</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((wrestler) => (
              <TableRow key={wrestler.id}>
                <TableCell>
                  <Link
                    href={`/roster/${wrestler.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {wrestler.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      wrestler.gender === "male"
                        ? "border-division-mens-singles text-division-mens-singles"
                        : "border-division-womens-singles text-division-womens-singles"
                    }
                  >
                    {wrestler.gender === "male" ? "M" : "F"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {wrestler.brand || "-"}
                </TableCell>
                <TableCell>{wrestler.overall_rating ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={wrestler.is_active ? "default" : "secondary"}>
                    {wrestler.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No wrestlers found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {wrestlers.length}
      </p>
    </div>
  );
}
