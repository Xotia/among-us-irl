import { useState } from "react";
import { PlayerRole } from "@among-us-irl/shared";
import type { RoleAssignmentDTO } from "@among-us-irl/shared";

interface RoleRevealProps {
  assignment: RoleAssignmentDTO;
  onDismiss: () => void;
}

export function RoleReveal({ assignment, onDismiss }: RoleRevealProps) {
  const [confirmed, setConfirmed] = useState(false);

  const isImpostor = assignment.role === PlayerRole.IMPOSTOR;

  if (confirmed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="flex flex-col items-center gap-6 p-8 text-center animate-fade-in">
        <div
          className={`text-6xl font-black uppercase tracking-wider ${
            isImpostor ? "text-red-500" : "text-cyan-400"
          }`}
        >
          {isImpostor ? "Imposteur" : "Crewmate"}
        </div>

        <div className="text-lg text-gray-300">
          {isImpostor
            ? "Éliminez les crewmates sans vous faire repérer."
            : "Complétez les tâches et trouvez les imposteurs."}
        </div>

        {isImpostor && assignment.coImpostors && assignment.coImpostors.length > 0 && (
          <div className="bg-red-950/50 border border-red-800 rounded-xl px-6 py-4 mt-2">
            <p className="text-sm text-red-300 mb-2">Co-imposteur{assignment.coImpostors.length > 1 ? "s" : ""} :</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {assignment.coImpostors.map((name) => (
                <span
                  key={name}
                  className="bg-red-900/50 text-red-200 px-3 py-1 rounded-full text-sm font-semibold"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => {
            setConfirmed(true);
            onDismiss();
          }}
          className={`mt-4 px-8 py-3 rounded-lg font-bold text-lg transition-colors ${
            isImpostor
              ? "bg-red-600 hover:bg-red-700"
              : "bg-cyan-600 hover:bg-cyan-700"
          }`}
        >
          Compris
        </button>
      </div>
    </div>
  );
}
