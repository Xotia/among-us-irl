import type { Server } from "socket.io";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import {
  gameInstances,
  gameConfigs,
  playersInGame,
  meetingStates,
  votes,
  sabotageStates,
  gameEvents,
} from "../models/schema.js";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  MeetingDTO,
  VoteResultDTO,
} from "@among-us-irl/shared";
import {
  GameStatus,
  GamePhase,
  MeetingState,
  PlayerRole,
  Winner,
  GameOverReason,
} from "@among-us-irl/shared";
import { endGame } from "./gameEndService.js";
import { pauseGameTimer, resumeGameTimer } from "./gameTimerService.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export async function requestMeeting(
  io: TypedServer,
  gameId: string,
  playerId: string,
  isBodyReport: boolean
): Promise<{ success: true } | { error: string }> {
  const [game] = await db
    .select()
    .from(gameInstances)
    .where(eq(gameInstances.id, gameId))
    .limit(1);
  if (!game || game.status !== GameStatus.RUNNING)
    return { error: "La partie n'est pas en cours" };
  if (game.phase !== GamePhase.FREE_ROAM)
    return { error: "Un rassemblement est déjà en cours" };

  const [player] = await db
    .select()
    .from(playersInGame)
    .where(and(eq(playersInGame.id, playerId), eq(playersInGame.gameId, gameId)))
    .limit(1);
  if (!player || player.lifeState !== "ALIVE")
    return { error: "Seul un joueur vivant peut déclencher un rassemblement" };

  if (!isBodyReport) {
    const [sabotage] = await db
      .select()
      .from(sabotageStates)
      .where(eq(sabotageStates.gameId, gameId))
      .limit(1);
    if (sabotage && sabotage.state === "ACTIVE")
      return { error: "Impossible de déclencher un rassemblement pendant un sabotage actif" };
  }

  const [config] = await db
    .select()
    .from(gameConfigs)
    .where(eq(gameConfigs.gameId, gameId))
    .limit(1);
  if (!config) return { error: "Configuration introuvable" };

  const timerEndsAt = new Date(Date.now() + config.meetingDurationSeconds * 1000);

  const [meeting] = await db.insert(meetingStates).values({
    gameId,
    state: MeetingState.VOTING,
    triggeredBy: playerId,
    isBodyReport,
    timerEndsAt,
  }).returning();

  await db
    .update(gameInstances)
    .set({ phase: GamePhase.MEETING_IN_PROGRESS, updatedAt: new Date() })
    .where(eq(gameInstances.id, gameId));

  await db.insert(gameEvents).values({
    gameId,
    type: isBodyReport ? "BODY_REPORTED" : "MEETING_CALLED",
    payload: { playerId, pseudo: player.pseudo, meetingId: meeting.id },
  });

  const meetingDTO: MeetingDTO = {
    state: MeetingState.VOTING,
    triggeredBy: player.pseudo,
    isBodyReport,
    timerEndsAt: timerEndsAt.getTime(),
  };
  io.to(gameId).emit("meeting:update", meetingDTO);
  io.to(gameId).emit("game:phase", GamePhase.MEETING_IN_PROGRESS);

  if (game.gameTimerEndsAt) {
    pauseGameTimer(gameId, game.gameTimerEndsAt);
  }

  scheduleMeetingTransition(io, gameId, meeting.id, config.meetingDurationSeconds);

  return { success: true };
}

export async function forceMeeting(
  io: TypedServer,
  gameId: string,
  adminId: string
): Promise<{ success: true } | { error: string }> {
  const [game] = await db
    .select()
    .from(gameInstances)
    .where(eq(gameInstances.id, gameId))
    .limit(1);
  if (!game || game.status !== GameStatus.RUNNING)
    return { error: "La partie n'est pas en cours" };
  if (game.phase !== GamePhase.FREE_ROAM)
    return { error: "Un rassemblement est déjà en cours" };

  const [adminPlayer] = await db
    .select()
    .from(playersInGame)
    .where(and(eq(playersInGame.adminId, adminId), eq(playersInGame.gameId, gameId)))
    .limit(1);

  const triggeredBy = adminPlayer?.id ?? null;
  const triggerPseudo = adminPlayer?.pseudo ?? "Admin";

  const [config] = await db
    .select()
    .from(gameConfigs)
    .where(eq(gameConfigs.gameId, gameId))
    .limit(1);
  if (!config) return { error: "Configuration introuvable" };

  const timerEndsAt = new Date(Date.now() + config.meetingDurationSeconds * 1000);

  const [meeting] = await db.insert(meetingStates).values({
    gameId,
    state: MeetingState.VOTING,
    triggeredBy,
    isBodyReport: false,
    timerEndsAt,
  }).returning();

  await db
    .update(gameInstances)
    .set({ phase: GamePhase.MEETING_IN_PROGRESS, updatedAt: new Date() })
    .where(eq(gameInstances.id, gameId));

  await db.insert(gameEvents).values({
    gameId,
    type: "MEETING_FORCED",
    payload: { adminId, meetingId: meeting.id },
  });

  const meetingDTO: MeetingDTO = {
    state: MeetingState.VOTING,
    triggeredBy: triggerPseudo,
    isBodyReport: false,
    timerEndsAt: timerEndsAt.getTime(),
  };
  io.to(gameId).emit("meeting:update", meetingDTO);
  io.to(gameId).emit("game:phase", GamePhase.MEETING_IN_PROGRESS);

  if (game.gameTimerEndsAt) {
    pauseGameTimer(gameId, game.gameTimerEndsAt);
  }

  scheduleMeetingTransition(io, gameId, meeting.id, config.meetingDurationSeconds);

  return { success: true };
}

function scheduleMeetingTransition(
  io: TypedServer,
  gameId: string,
  meetingId: string,
  durationSeconds: number
) {
  setTimeout(async () => {
    await resolveMeeting(io, gameId, meetingId);
  }, durationSeconds * 1000);
}

export async function castVote(
  io: TypedServer,
  gameId: string,
  meetingId: string,
  voterId: string,
  targetPlayerId: string | null
): Promise<{ success: true } | { error: string }> {
  const [meeting] = await db
    .select()
    .from(meetingStates)
    .where(and(eq(meetingStates.id, meetingId), eq(meetingStates.gameId, gameId)))
    .limit(1);
  if (!meeting || meeting.state !== MeetingState.VOTING)
    return { error: "Le vote n'est pas ouvert" };

  const [voter] = await db
    .select()
    .from(playersInGame)
    .where(and(eq(playersInGame.id, voterId), eq(playersInGame.gameId, gameId)))
    .limit(1);
  if (!voter || voter.lifeState !== "ALIVE")
    return { error: "Seul un joueur vivant peut voter" };

  if (targetPlayerId) {
    const [target] = await db
      .select()
      .from(playersInGame)
      .where(and(eq(playersInGame.id, targetPlayerId), eq(playersInGame.gameId, gameId)))
      .limit(1);
    if (!target || target.lifeState !== "ALIVE")
      return { error: "La cible n'est pas un joueur vivant" };
  }

  const existingVotes = await db
    .select()
    .from(votes)
    .where(and(eq(votes.meetingId, meetingId), eq(votes.voterId, voterId)));
  if (existingVotes.length > 0) {
    await db
      .update(votes)
      .set({ targetId: targetPlayerId, createdAt: new Date() })
      .where(and(eq(votes.meetingId, meetingId), eq(votes.voterId, voterId)));
  } else {
    await db.insert(votes).values({
      meetingId,
      voterId,
      targetId: targetPlayerId,
    });
  }

  const allVotes = await db.select().from(votes).where(eq(votes.meetingId, meetingId));
  const alivePlayers = await db
    .select()
    .from(playersInGame)
    .where(eq(playersInGame.gameId, gameId));
  const aliveCount = alivePlayers.filter((p) => p.lifeState === "ALIVE").length;

  if (allVotes.length >= aliveCount) {
    await resolveMeeting(io, gameId, meetingId);
  }

  return { success: true };
}

async function resolveMeeting(
  io: TypedServer,
  gameId: string,
  meetingId: string
) {
  const [meeting] = await db
    .select()
    .from(meetingStates)
    .where(eq(meetingStates.id, meetingId))
    .limit(1);
  if (!meeting || meeting.state === MeetingState.CLOSED) return;

  await db
    .update(meetingStates)
    .set({ state: MeetingState.RESOLVING })
    .where(eq(meetingStates.id, meetingId));

  const allVotes = await db.select().from(votes).where(eq(votes.meetingId, meetingId));
  const alivePlayers = await db
    .select()
    .from(playersInGame)
    .where(eq(playersInGame.gameId, gameId));
  const alivePlayerIds = new Set(
    alivePlayers.filter((p) => p.lifeState === "ALIVE").map((p) => p.id)
  );

  const validVotes = allVotes.filter((v) => alivePlayerIds.has(v.voterId));

  const voteCounts = new Map<string, number>();
  let skipCount = 0;
  for (const v of validVotes) {
    if (!v.targetId) {
      skipCount++;
    } else if (alivePlayerIds.has(v.targetId)) {
      voteCounts.set(v.targetId, (voteCounts.get(v.targetId) ?? 0) + 1);
    } else {
      skipCount++;
    }
  }

  let maxVotes = skipCount;
  let eliminatedId: string | null = null;
  let isTie = false;

  for (const [playerId, count] of voteCounts.entries()) {
    if (count > maxVotes) {
      maxVotes = count;
      eliminatedId = playerId;
      isTie = false;
    } else if (count === maxVotes) {
      isTie = true;
    }
  }

  if (isTie) eliminatedId = null;

  const votesRecord: Record<string, string> = {};
  const playerMap = new Map(alivePlayers.map((p) => [p.id, p.pseudo]));
  for (const v of validVotes) {
    const voterPseudo = playerMap.get(v.voterId) ?? v.voterId;
    const targetPseudo = v.targetId ? (playerMap.get(v.targetId) ?? "???") : "SKIP";
    votesRecord[voterPseudo] = targetPseudo;
  }

  if (eliminatedId) {
    await db
      .update(playersInGame)
      .set({ lifeState: "EJECTED" })
      .where(eq(playersInGame.id, eliminatedId));
  }

  await db
    .update(meetingStates)
    .set({ state: MeetingState.CLOSED })
    .where(eq(meetingStates.id, meetingId));

  await db
    .update(gameInstances)
    .set({ phase: GamePhase.FREE_ROAM, updatedAt: new Date() })
    .where(eq(gameInstances.id, gameId));

  const eliminatedPseudo = eliminatedId ? playerMap.get(eliminatedId) : null;
  await db.insert(gameEvents).values({
    gameId,
    type: "MEETING_RESOLVED",
    payload: { meetingId, eliminatedPlayerId: eliminatedId, eliminatedPseudo },
  });

  let eliminatedRole: string | undefined;
  if (eliminatedId) {
    const [config] = await db.select().from(gameConfigs).where(eq(gameConfigs.gameId, gameId)).limit(1);
    if (config?.revealRoleOnEject) {
      const eliminated = alivePlayers.find((p) => p.id === eliminatedId);
      eliminatedRole = eliminated?.role ?? undefined;
    }
  }

  const result: VoteResultDTO = {
    eliminatedPlayerId: eliminatedId,
    eliminatedRole,
    votes: votesRecord,
  };
  io.to(gameId).emit("meeting:result", result);

  if (eliminatedId) {
    io.to(gameId).emit("player:died", eliminatedId);
    const updatedPlayers = await db
      .select()
      .from(playersInGame)
      .where(eq(playersInGame.gameId, gameId));
    const playerDTOs = updatedPlayers.map((p) => ({
      id: p.id,
      pseudo: p.pseudo,
      isAlive: p.lifeState === "ALIVE",
      isConnected: p.isConnected,
    }));
    io.to(gameId).emit("players:update", playerDTOs);
  }

  setTimeout(async () => {
    io.to(gameId).emit("game:phase", GamePhase.FREE_ROAM);
    io.to(gameId).emit("meeting:update", {
      state: MeetingState.IDLE,
      triggeredBy: "",
      isBodyReport: false,
    });
    await resumeGameTimer(io, gameId);
  }, 5000);

  if (eliminatedId) {
    const updatedAlive = await db
      .select({ role: playersInGame.role, lifeState: playersInGame.lifeState })
      .from(playersInGame)
      .where(eq(playersInGame.gameId, gameId));
    const alive = updatedAlive.filter((p) => p.lifeState === "ALIVE");
    const aliveImpostors = alive.filter((p) => p.role === PlayerRole.IMPOSTOR).length;
    const aliveCrewmates = alive.filter((p) => p.role === PlayerRole.CREWMATE).length;

    if (aliveImpostors === 0) {
      await endGame(io, gameId, Winner.CREWMATES, GameOverReason.IMPOSTORS_ELIMINATED);
    } else if (aliveImpostors >= aliveCrewmates) {
      await endGame(io, gameId, Winner.IMPOSTORS, GameOverReason.IMPOSTORS_MAJORITY);
    }
  }
}

export async function getActiveMeeting(gameId: string): Promise<MeetingDTO | null> {
  const [meeting] = await db
    .select()
    .from(meetingStates)
    .where(eq(meetingStates.gameId, gameId))
    .limit(1);

  if (!meeting || meeting.state === MeetingState.IDLE || meeting.state === MeetingState.CLOSED)
    return null;

  const [player] = meeting.triggeredBy
    ? await db.select().from(playersInGame).where(eq(playersInGame.id, meeting.triggeredBy)).limit(1)
    : [null];

  return {
    state: meeting.state as MeetingState,
    triggeredBy: player?.pseudo ?? "Admin",
    isBodyReport: meeting.isBodyReport,
    timerEndsAt: meeting.timerEndsAt?.getTime(),
  };
}

export async function getActiveMeetingId(gameId: string): Promise<string | null> {
  const rows = await db
    .select({ id: meetingStates.id, state: meetingStates.state })
    .from(meetingStates)
    .where(eq(meetingStates.gameId, gameId));

  const active = rows.find(
    (r) => r.state !== MeetingState.IDLE && r.state !== MeetingState.CLOSED
  );
  return active?.id ?? null;
}
