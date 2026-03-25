"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { createTagTeam } from "@/app/actions";
import { toast } from "sonner";

interface TagTeam {
  id: string;
  name: string;
  is_active: boolean;
  wrestler_a: { id: string; name: string; gender: string } | null;
  wrestler_b: { id: string; name: string; gender: string } | null;
}

interface Wrestler {
  id: string;
  name: string;
  gender: string;
}

export function TagTeamList({
  tagTeams,
  wrestlers,
}: {
  tagTeams: TagTeam[];
  wrestlers: Wrestler[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [memberA, setMemberA] = useState("");
  const [memberB, setMemberB] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!memberA || !memberB || memberA === memberB) {
      toast.error("Select two different wrestlers");
      return;
    }
    setLoading(true);
    try {
      await createTagTeam({
        name,
        wrestler_a_id: memberA,
        wrestler_b_id: memberB,
      });
      toast.success(`${name} created`);
      setName("");
      setMemberA("");
      setMemberB("");
      setShowForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button size="sm" onClick={() => setShowForm(!showForm)}>
        {showForm ? "Cancel" : "Create Tag Team"}
      </Button>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1">
                <Label>Team Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="The Shield"
                  required
                />
              </div>
              <div className="w-48 space-y-1">
                <Label>Member 1</Label>
                <Select value={memberA} onValueChange={(v) => setMemberA(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {wrestlers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48 space-y-1">
                <Label>Member 2</Label>
                <Select value={memberB} onValueChange={(v) => setMemberB(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {wrestlers
                      .filter((w) => w.id !== memberA)
                      .map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tagTeams.map((team) => (
          <Card key={team.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{team.name}</CardTitle>
                <Badge variant={team.is_active ? "default" : "secondary"}>
                  {team.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {team.wrestler_a?.name} & {team.wrestler_b?.name}
              </p>
            </CardContent>
          </Card>
        ))}
        {tagTeams.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground">
            No tag teams created yet
          </p>
        )}
      </div>
    </div>
  );
}
