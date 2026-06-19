import type { UserRole } from "./enums.js";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: { id: string; username: string; role: UserRole };
}

export interface GuestJoinRequest {
  pseudo: string;
  gameCode: string;
}

export interface GuestJoinResponse {
  token: string;
  sessionId: string;
  pseudo: string;
  gameId: string;
  gameCode: string;
  reconnectToken: string;
}

export interface ReconnectResponse {
  token: string;
  sessionId: string;
  pseudo: string;
  gameId: string;
  gameCode: string;
  gameStatus: string;
}

export interface AuthErrorResponse {
  error: string;
}

// --- Sprint 2: Game creation & configuration ---

export interface TaskConfigItem {
  name: string;
  description?: string;
}

export interface GameConfigDTO {
  minPlayers: number;
  maxPlayers: number;
  impostorCount: number;
  gameDurationSeconds: number;
  meetingDurationSeconds: number;
  sabotageDurationSeconds: number;
  sabotageCooldownSeconds: number;
  taskValidationMode: "ANY_PLAYER" | "ADMIN_ONLY";
  oxygenCode: string;
  revealRoleOnEject: boolean;
  tasks: TaskConfigItem[];
}

export interface CreateGameRequest {
  presetCode?: string;
}

export interface CreateGameResponse {
  gameId: string;
  code: string;
  config: GameConfigDTO;
}

export interface UpdateGameConfigRequest {
  config: Partial<GameConfigDTO>;
}

export interface GameDetailDTO {
  id: string;
  code: string;
  status: string;
  config: GameConfigDTO;
  createdAt: string;
}

export interface PresetDTO {
  code: string;
  name: string;
  config: Partial<GameConfigDTO>;
}

export interface ImportPresetRequest {
  code: string;
  name: string;
  config: Partial<GameConfigDTO>;
}

export const DEFAULT_GAME_CONFIG: GameConfigDTO = {
  minPlayers: 4,
  maxPlayers: 15,
  impostorCount: 2,
  gameDurationSeconds: 300,
  meetingDurationSeconds: 60,
  sabotageDurationSeconds: 45,
  sabotageCooldownSeconds: 20,
  taskValidationMode: "ANY_PLAYER",
  oxygenCode: "4782",
  revealRoleOnEject: true,
  tasks: [
    { name: "Chiffres Romains", description: "Convertissez les chiffres en chiffres romains" },
    { name: "Décodage", description: "Déchiffrez le message codé" },
    { name: "Reliure de points", description: "Reliez les points pour former l'image" },
    { name: "Recopie les phrases", description: "Recopiez les phrases sans erreur" },
    { name: "Rébus", description: "Trouvez la solution du rébus" },
    { name: "Mots mêlés", description: "Trouvez tous les mots cachés dans la grille" },
    { name: "Puzzle", description: "Assemblez le puzzle" },
    { name: "Calculs", description: "Résolvez les opérations mathématiques" },
    { name: "Kappla", description: "Construisez la structure en Kappla" },
    { name: "Bottle flip", description: "Réussissez un bottle flip" },
    { name: "Tri sélectif", description: "Triez les déchets dans les bonnes poubelles" },
    { name: "Déboucher et reboucher les stylos", description: "Débouchez puis rebouchez tous les stylos" },
    { name: "Sudoku", description: "Complétez la grille de Sudoku" },
    { name: "Lancer d'anneaux", description: "Lancez les anneaux sur les cibles" },
    { name: "Basket", description: "Marquez un panier" },
  ],
};

export const CONFIG_LIMITS = {
  minPlayers: { min: 4, max: 15 },
  maxPlayers: { min: 4, max: 15 },
  impostorCount: { min: 1, max: 4 },
  gameDurationSeconds: { min: 300, max: 7200 },
  meetingDurationSeconds: { min: 30, max: 600 },
  sabotageDurationSeconds: { min: 15, max: 300 },
  sabotageCooldownSeconds: { min: 10, max: 300 },
  oxygenCodeLength: { min: 4, max: 8 },
  maxTasks: 30,
} as const;
