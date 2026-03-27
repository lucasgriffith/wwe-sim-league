export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Gender = "male" | "female";
export type DivisionType = "singles" | "tag";
export type PoolLabel = "A" | "B";
export type SeasonStatus =
  | "setup"
  | "pool_play"
  | "playoffs"
  | "relegation"
  | "completed";
export type MatchPhase =
  | "pool_play"
  | "quarterfinal"
  | "semifinal"
  | "final"
  | "relegation";
export type MovementType =
  | "auto_promote"
  | "auto_relegate"
  | "playoff_promote"
  | "playoff_relegate"
  | "playoff_survive";

export interface Database {
  public: {
    Tables: {
      wrestlers: {
        Row: {
          id: string;
          name: string;
          gender: Gender;
          brand: string | null;
          overall_rating: number | null;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          gender: Gender;
          brand?: string | null;
          overall_rating?: number | null;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          gender?: Gender;
          brand?: string | null;
          overall_rating?: number | null;
          image_url?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      divisions: {
        Row: {
          id: string;
          name: string;
          gender: Gender;
          division_type: DivisionType;
          display_order: number;
        };
        Insert: {
          id?: string;
          name: string;
          gender: Gender;
          division_type: DivisionType;
          display_order?: number;
        };
        Update: {
          name?: string;
          gender?: Gender;
          division_type?: DivisionType;
          display_order?: number;
        };
      };
      tiers: {
        Row: {
          id: string;
          division_id: string;
          tier_number: number;
          name: string;
          short_name: string | null;
          color: string | null;
          pool_size: number;
          has_pools: boolean;
          fixed_stipulation: string | null;
          belt_image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          division_id: string;
          tier_number: number;
          name: string;
          short_name?: string | null;
          color?: string | null;
          pool_size?: number;
          has_pools?: boolean;
          fixed_stipulation?: string | null;
          belt_image_url?: string | null;
          created_at?: string;
        };
        Update: {
          division_id?: string;
          tier_number?: number;
          name?: string;
          short_name?: string | null;
          color?: string | null;
          pool_size?: number;
          has_pools?: boolean;
          fixed_stipulation?: string | null;
          belt_image_url?: string | null;
        };
      };
      seasons: {
        Row: {
          id: string;
          season_number: number;
          status: SeasonStatus;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          season_number: number;
          status?: SeasonStatus;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          season_number?: number;
          status?: SeasonStatus;
          started_at?: string | null;
          completed_at?: string | null;
        };
      };
      tag_teams: {
        Row: {
          id: string;
          name: string;
          wrestler_a_id: string;
          wrestler_b_id: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          wrestler_a_id: string;
          wrestler_b_id: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          wrestler_a_id?: string;
          wrestler_b_id?: string;
          is_active?: boolean;
        };
      };
      tier_assignments: {
        Row: {
          id: string;
          season_id: string;
          tier_id: string;
          wrestler_id: string | null;
          tag_team_id: string | null;
          pool: PoolLabel | null;
          seed: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          season_id: string;
          tier_id: string;
          wrestler_id?: string | null;
          tag_team_id?: string | null;
          pool?: PoolLabel | null;
          seed?: number | null;
          created_at?: string;
        };
        Update: {
          season_id?: string;
          tier_id?: string;
          wrestler_id?: string | null;
          tag_team_id?: string | null;
          pool?: PoolLabel | null;
          seed?: number | null;
        };
      };
      matches: {
        Row: {
          id: string;
          season_id: string;
          tier_id: string;
          round_number: number | null;
          match_phase: MatchPhase;
          pool: PoolLabel | null;
          wrestler_a_id: string | null;
          wrestler_b_id: string | null;
          tag_team_a_id: string | null;
          tag_team_b_id: string | null;
          winner_wrestler_id: string | null;
          winner_tag_team_id: string | null;
          match_time_seconds: number | null;
          stipulation: string | null;
          notes: string | null;
          played_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          season_id: string;
          tier_id: string;
          round_number?: number | null;
          match_phase: MatchPhase;
          pool?: PoolLabel | null;
          wrestler_a_id?: string | null;
          wrestler_b_id?: string | null;
          tag_team_a_id?: string | null;
          tag_team_b_id?: string | null;
          winner_wrestler_id?: string | null;
          winner_tag_team_id?: string | null;
          match_time_seconds?: number | null;
          stipulation?: string | null;
          notes?: string | null;
          played_at?: string | null;
          created_at?: string;
        };
        Update: {
          round_number?: number | null;
          match_phase?: MatchPhase;
          pool?: PoolLabel | null;
          winner_wrestler_id?: string | null;
          winner_tag_team_id?: string | null;
          match_time_seconds?: number | null;
          stipulation?: string | null;
          notes?: string | null;
          played_at?: string | null;
        };
      };
      relegation_events: {
        Row: {
          id: string;
          season_id: string;
          tier_id: string;
          wrestler_id: string | null;
          tag_team_id: string | null;
          movement_type: MovementType;
          from_tier_id: string | null;
          to_tier_id: string | null;
          match_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          season_id: string;
          tier_id: string;
          wrestler_id?: string | null;
          tag_team_id?: string | null;
          movement_type: MovementType;
          from_tier_id?: string | null;
          to_tier_id?: string | null;
          match_id?: string | null;
          created_at?: string;
        };
        Update: {
          movement_type?: MovementType;
          from_tier_id?: string | null;
          to_tier_id?: string | null;
          match_id?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      gender: Gender;
      division_type: DivisionType;
      pool_label: PoolLabel;
      season_status: SeasonStatus;
      match_phase: MatchPhase;
      movement_type: MovementType;
    };
  };
}
