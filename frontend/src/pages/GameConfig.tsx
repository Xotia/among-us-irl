import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { useAuth, saveAuth } from "../lib/auth";
import {
  CONFIG_LIMITS,
  DEFAULT_GAME_CONFIG,
} from "@among-us-irl/shared";
import type {
  GameDetailDTO,
  GameConfigDTO,
  TaskConfigItem,
} from "@among-us-irl/shared";

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          className="flex-1 bg-surface text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-accent"
        />
        {suffix && <span className="text-gray-400 text-sm">{suffix}</span>}
      </div>
    </div>
  );
}

export function GameConfig() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { auth, setAuth } = useAuth();
  const [game, setGame] = useState<GameDetailDTO | null>(null);
  const [config, setConfig] = useState<GameConfigDTO>(DEFAULT_GAME_CONFIG);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newTaskName, setNewTaskName] = useState("");
  const [importJson, setImportJson] = useState("");
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    apiFetch<GameDetailDTO>(`/games/${id}`)
      .then((g) => {
        setGame(g);
        setConfig(g.config);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Erreur de chargement");
      });
  }, [id]);

  const updateField = useCallback(
    <K extends keyof GameConfigDTO>(key: K, value: GameConfigDTO[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
      setSuccess("");
    },
    []
  );

  async function handleSave() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const updated = await apiFetch<GameConfigDTO>(`/games/${id}/config`, {
        method: "PATCH",
        body: JSON.stringify(config),
      });
      setConfig(updated);
      setSuccess("Configuration sauvegardée");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  function addTask() {
    const name = newTaskName.trim();
    if (!name) return;
    if (config.tasks.length >= CONFIG_LIMITS.maxTasks) return;
    updateField("tasks", [...config.tasks, { name }]);
    setNewTaskName("");
  }

  function removeTask(index: number) {
    updateField(
      "tasks",
      config.tasks.filter((_, i) => i !== index)
    );
  }

  function handleImportPreset() {
    try {
      const parsed = JSON.parse(importJson);
      const configOverrides = parsed.config ?? parsed;
      setConfig((prev) => ({ ...prev, ...configOverrides }));
      setShowImport(false);
      setImportJson("");
      setSuccess("Preset importé — pensez à sauvegarder");
    } catch {
      setError("JSON invalide");
    }
  }

  function copyCode() {
    if (game) navigator.clipboard.writeText(game.code);
  }

  if (!game && !error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center p-6 overflow-y-auto">
      <div className="w-full max-w-md">
        {game && (
          <div className="text-center mb-6">
            <p className="text-sm text-gray-400 mb-1">Code d'invitation</p>
            <button
              onClick={copyCode}
              className="text-5xl font-mono font-bold tracking-widest text-accent hover:text-accent/80 transition-colors"
              title="Copier le code"
            >
              {game.code}
            </button>
            <p className="text-xs text-gray-500 mt-1">Cliquer pour copier</p>
          </div>
        )}

        <h1 className="text-2xl font-bold mb-4">Configuration</h1>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 rounded-lg px-4 py-2 text-sm mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-300 rounded-lg px-4 py-2 text-sm mb-4">
            {success}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Min joueurs"
              value={config.minPlayers}
              onChange={(v) => updateField("minPlayers", v)}
              min={CONFIG_LIMITS.minPlayers.min}
              max={CONFIG_LIMITS.minPlayers.max}
            />
            <NumberField
              label="Max joueurs"
              value={config.maxPlayers}
              onChange={(v) => updateField("maxPlayers", v)}
              min={CONFIG_LIMITS.maxPlayers.min}
              max={CONFIG_LIMITS.maxPlayers.max}
            />
          </div>

          <NumberField
            label="Nombre d'imposteurs"
            value={config.impostorCount}
            onChange={(v) => updateField("impostorCount", v)}
            min={CONFIG_LIMITS.impostorCount.min}
            max={CONFIG_LIMITS.impostorCount.max}
          />

          <NumberField
            label="Durée de la partie"
            value={config.gameDurationSeconds}
            onChange={(v) => updateField("gameDurationSeconds", v)}
            min={CONFIG_LIMITS.gameDurationSeconds.min}
            max={CONFIG_LIMITS.gameDurationSeconds.max}
            suffix="sec"
          />

          <NumberField
            label="Durée du meeting"
            value={config.meetingDurationSeconds}
            onChange={(v) => updateField("meetingDurationSeconds", v)}
            min={CONFIG_LIMITS.meetingDurationSeconds.min}
            max={CONFIG_LIMITS.meetingDurationSeconds.max}
            suffix="sec"
          />

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Durée sabotage"
              value={config.sabotageDurationSeconds}
              onChange={(v) => updateField("sabotageDurationSeconds", v)}
              min={CONFIG_LIMITS.sabotageDurationSeconds.min}
              max={CONFIG_LIMITS.sabotageDurationSeconds.max}
              suffix="sec"
            />
            <NumberField
              label="Cooldown sabotage"
              value={config.sabotageCooldownSeconds}
              onChange={(v) => updateField("sabotageCooldownSeconds", v)}
              min={CONFIG_LIMITS.sabotageCooldownSeconds.min}
              max={CONFIG_LIMITS.sabotageCooldownSeconds.max}
              suffix="sec"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Validation des tâches
            </label>
            <select
              value={config.taskValidationMode}
              onChange={(e) =>
                updateField(
                  "taskValidationMode",
                  e.target.value as "ANY_PLAYER" | "ADMIN_ONLY"
                )
              }
              className="w-full bg-surface text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="ANY_PLAYER">Tout joueur vivant</option>
              <option value="ADMIN_ONLY">Admin uniquement</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Code oxygène
            </label>
            <input
              type="text"
              value={config.oxygenCode}
              onChange={(e) => updateField("oxygenCode", e.target.value)}
              maxLength={CONFIG_LIMITS.oxygenCodeLength.max}
              pattern="\d+"
              className="w-full bg-surface text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-accent font-mono text-lg tracking-widest"
            />
          </div>

          {/* Reveal role on eject */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">
              Révéler le rôle après éjection
            </label>
            <button
              type="button"
              onClick={() => updateField("revealRoleOnEject", !config.revealRoleOnEject)}
              className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                config.revealRoleOnEject ? "bg-accent" : "bg-gray-600"
              }`}
            >
              <span
                className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all"
                style={{ left: config.revealRoleOnEject ? "calc(100% - 1.375rem)" : "0.125rem" }}
              />
            </button>
          </div>

          {/* Single use sabotage */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">
              Sabotage unique par type
            </label>
            <button
              type="button"
              onClick={() => updateField("singleUseSabotage", !config.singleUseSabotage)}
              className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                config.singleUseSabotage ? "bg-accent" : "bg-gray-600"
              }`}
            >
              <span
                className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all"
                style={{ left: config.singleUseSabotage ? "calc(100% - 1.375rem)" : "0.125rem" }}
              />
            </button>
          </div>

          {/* Tasks */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Tâches ({config.tasks.length}/{CONFIG_LIMITS.maxTasks})
            </label>
            <div className="flex flex-col gap-2 mb-2">
              {config.tasks.map((task: TaskConfigItem, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-surface rounded-lg px-3 py-2"
                >
                  <span className="text-sm">{task.name}</span>
                  <button
                    onClick={() => removeTask(i)}
                    className="text-red-400 hover:text-red-300 text-sm ml-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nom de la tâche"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                className="flex-1 bg-surface text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                maxLength={200}
              />
              <button
                onClick={addTask}
                disabled={!newTaskName.trim() || config.tasks.length >= CONFIG_LIMITS.maxTasks}
                className="bg-surface hover:bg-surface/80 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Import Preset JSON */}
          <div>
            {!showImport ? (
              <button
                onClick={() => setShowImport(true)}
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Importer un preset JSON
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder='{"minPlayers": 6, "impostorCount": 2, ...}'
                  rows={4}
                  className="w-full bg-surface text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent font-mono"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleImportPreset}
                    className="bg-accent hover:bg-accent/80 text-white text-sm px-3 py-2 rounded-lg transition-colors"
                  >
                    Appliquer
                  </button>
                  <button
                    onClick={() => {
                      setShowImport(false);
                      setImportJson("");
                    }}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-accent hover:bg-accent/80 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {saving ? "Sauvegarde…" : "Sauvegarder la config"}
          </button>

          {game && (
            <button
              onClick={() => {
                if (auth) {
                  const updated = { ...auth, gameId: game.id, gameCode: game.code };
                  saveAuth(updated);
                  setAuth(updated);
                }
                navigate(`/lobby/${game.code}`);
              }}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Rejoindre le lobby
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            ← Retour au tableau de bord
          </button>
        </div>
      </div>
    </div>
  );
}
