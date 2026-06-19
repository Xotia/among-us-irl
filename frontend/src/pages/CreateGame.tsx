import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import type {
  CreateGameResponse,
  PresetDTO,
} from "@among-us-irl/shared";

export function CreateGame() {
  const [presets, setPresets] = useState<PresetDTO[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<PresetDTO[]>("/games/presets/list").then(setPresets).catch(() => {});
  }, []);

  async function handleCreate() {
    setError("");
    setLoading(true);
    try {
      const body: Record<string, string> = {};
      if (selectedPreset) body.presetCode = selectedPreset;

      const res = await apiFetch<CreateGameResponse>("/games", {
        method: "POST",
        body: JSON.stringify(body),
      });

      navigate(`/admin/games/${res.gameId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-6">Créer une partie</h1>

      <div className="w-full max-w-xs flex flex-col gap-4">
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 rounded-lg px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {presets.length > 0 && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Preset (optionnel)
            </label>
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              className="w-full bg-surface text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Aucun preset</option>
              {presets.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="bg-accent hover:bg-accent/80 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {loading ? "Création…" : "Créer la partie"}
        </button>

        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← Retour
        </button>
      </div>
    </div>
  );
}
