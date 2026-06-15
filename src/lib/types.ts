export type Match = {
  id: string;
  team1: string;
  team2: string;
  kickoff_time: string;
  home_score: number | null;
  away_score: number | null;
  status: "upcoming" | "finished";
  is_open: boolean;
  created_at: string;
};

export type Prediction = {
  id: string;
  player_name: string;
  match_id: string;
  predicted_home: number;
  predicted_away: number;
  created_at: string;
};

export type Reward = {
  id: string;
  player_name: string;
  match_id: string | null;
  pay_date: string | null;
  amount: number;
  created_at: string;
};

export type Player = {
  id: string;
  name: string;
  created_at: string;
};
