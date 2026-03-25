"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { createWrestler } from "@/app/actions";
import { toast } from "sonner";
import type { Gender } from "@/types/database";

export function WrestlerForm({ onSuccess }: { onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [brand, setBrand] = useState("");
  const [overallRating, setOverallRating] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await createWrestler({
        name,
        gender,
        brand: brand || undefined,
        overall_rating: overallRating ? parseInt(overallRating) : undefined,
      });
      toast.success(`${name} added to roster`);
      setName("");
      setBrand("");
      setOverallRating("");
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add wrestler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Wrestler name"
              required
            />
          </div>
          <div className="w-32 space-y-1">
            <Label>Gender</Label>
            <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-32 space-y-1">
            <Label htmlFor="brand">Brand</Label>
            <Input
              id="brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Raw, SD..."
            />
          </div>
          <div className="w-24 space-y-1">
            <Label htmlFor="overall">Overall</Label>
            <Input
              id="overall"
              type="number"
              min={0}
              max={100}
              value={overallRating}
              onChange={(e) => setOverallRating(e.target.value)}
              placeholder="85"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Adding..." : "Add"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
