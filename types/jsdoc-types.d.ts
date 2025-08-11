/**
 * Global JSDoc types for the project (optional if you use TS later).
 */
export interface SleeperPick {
  user_id: string | number;
  pick_no?: number;
  round?: number;
  metadata?: {
    first_name?: string;
    last_name?: string;
    team?: string;
    position?: string;
    [k: string]: any;
  };
  [k: string]: any;
}

export interface BoardRow {
  rk?: string | number;
  name?: string;
  team?: string;
  pos?: string;
  bye?: string | number;
  sos?: string | number;
  ecrVsAdp?: string | number;
  pick_no?: number;
  status?: 'me' | 'other';
}
