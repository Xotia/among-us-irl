import type {
  GamePhase,
  GameStatus,
  MeetingState,
  PlayerLifeState,
  PlayerRole,
  SabotageState,
  SabotageType,
  Winner,
  GameOverReason,
} from "./enums.js";

export interface PlayerDTO {
  id: string;
  pseudo: string;
  isAlive: boolean;
  isConnected: boolean;
}

export interface LobbyPlayerDTO {
  id: string;
  pseudo: string;
  isConnected: boolean;
}

export interface TaskDTO {
  id: string;
  name: string;
  description: string;
  isCompleted: boolean;
  completedBy?: string;
}

export interface RoleAssignmentDTO {
  role: PlayerRole;
  coImpostors?: string[];
}

export interface MeetingDTO {
  state: MeetingState;
  triggeredBy: string;
  isBodyReport: boolean;
  timerEndsAt?: number;
}

export interface SabotageDTO {
  state: SabotageState;
  type: SabotageType;
  timerEndsAt?: number;
}

export interface VoteResultDTO {
  eliminatedPlayerId: string | null;
  eliminatedRole?: string;
  votes: Record<string, string>;
}

export interface GameOverDTO {
  winner: Winner;
  reason: GameOverReason;
  roles: Record<string, PlayerRole>;
  events?: GameEventDTO[];
}

export interface GameEventDTO {
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ServerToClientEvents {
  "lobby:update": (players: LobbyPlayerDTO[]) => void;
  "player:joined": (player: LobbyPlayerDTO) => void;
  "player:left": (playerId: string) => void;
  "game:started": () => void;
  "role:assigned": (assignment: RoleAssignmentDTO) => void;
  "game:phase": (phase: GamePhase) => void;
  "game:timer": (endsAt: number) => void;
  "game:over": (result: GameOverDTO) => void;
  "task:completed": (task: TaskDTO) => void;
  "task:uncompleted": (task: TaskDTO) => void;
  "tasks:progress": (completed: number, total: number) => void;
  "player:died": (playerId: string) => void;
  "players:update": (players: PlayerDTO[]) => void;
  "meeting:update": (meeting: MeetingDTO) => void;
  "meeting:result": (result: VoteResultDTO) => void;
  "sabotage:update": (sabotage: SabotageDTO) => void;
  "sabotage:resolved": () => void;
  "connection:sync": (state: GameSyncStateDTO) => void;
}

export interface ClientToServerEvents {
  "game:join": (gameCode: string, token: string) => void;
  "meeting:call": () => void;
  "meeting:report": () => void;
  "vote:cast": (targetPlayerId: string | null) => void;
  "task:complete": (taskId: string) => void;
  "task:uncomplete": (taskId: string) => void;
  "sabotage:trigger": (type: SabotageType) => void;
  "sabotage:resolve": (code?: string) => void;
}

export interface GameSyncStateDTO {
  gameId: string;
  gameStatus: GameStatus;
  gamePhase: GamePhase;
  players: PlayerDTO[];
  tasks: TaskDTO[];
  meeting: MeetingDTO | null;
  sabotage: SabotageDTO | null;
  myPlayerId: string;
  myRole: PlayerRole;
  myLifeState: PlayerLifeState;
  gameTimerEndsAt: number | null;
  coImpostors?: string[];
  serverTime: number;
}
