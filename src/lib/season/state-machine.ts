import type { SeasonStatus } from "@/types/database";

const VALID_TRANSITIONS: Record<SeasonStatus, SeasonStatus | null> = {
  setup: "pool_play",
  pool_play: "playoffs",
  playoffs: "relegation",
  relegation: "completed",
  completed: null,
};

export function canTransition(
  current: SeasonStatus,
  target: SeasonStatus
): boolean {
  return VALID_TRANSITIONS[current] === target;
}

export function getNextStatus(current: SeasonStatus): SeasonStatus | null {
  return VALID_TRANSITIONS[current];
}

export function getStatusLabel(status: SeasonStatus): string {
  switch (status) {
    case "setup":
      return "Setup";
    case "pool_play":
      return "Pool Play";
    case "playoffs":
      return "Playoffs";
    case "relegation":
      return "Relegation";
    case "completed":
      return "Completed";
  }
}

export function getStatusColor(status: SeasonStatus): string {
  switch (status) {
    case "setup":
      return "bg-blue-500/20 text-blue-400";
    case "pool_play":
      return "bg-green-500/20 text-green-400";
    case "playoffs":
      return "bg-yellow-500/20 text-yellow-400";
    case "relegation":
      return "bg-red-500/20 text-red-400";
    case "completed":
      return "bg-muted text-muted-foreground";
  }
}
