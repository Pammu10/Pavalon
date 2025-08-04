"use client";
import React, { useState, useCallback, useEffect } from "react";
import { useGame } from "@/components/context/GameContext";
import { fetcher } from "@/services/api";
import api from "@/services/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import Button from "@/components/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Swords,
  BarChart2,
  Gamepad2,
  Trash2,
  Edit,
  Award,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Heart,
} from "lucide-react";

// --- Types for Admin Panel ---
type AdminUser = {
  id: number;
  username: string;
  created_at: string;
  is_admin: boolean;
};
type AdminRoom = {
  roomCode: string;
  playerCount: number;
  phase: string;
  players: { name: string; status: string }[];
};
type AllAchievement = { id: string; name: string };
type Friendship = {
  id: number;
  user1: string;
  user2: string;
  status: string;
  created_at: string;
};
type UserStat = {
  win_streak: number;
  highest_win_streak: number;
  assassin_kills: number;
  total_games: number;
  total_wins: number;
  good_games: number;
  good_wins: number;
  evil_games: number;
  evil_wins: number;
  db_defuses: number;
  db_futures_played: number;
  db_attacks_played: number;
  db_fillers_played: number;
};
type AdminMatch = {
  id: number;
  winner: string;
  played_at: string;
  players: string[] | null;
};

// --- Sub-components for Admin Panel ---

const GameManagementTab: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["adminMatches", currentPage],
    queryFn: () =>
      fetcher<{
        matches: AdminMatch[];
        totalPages: number;
        currentPage: number;
      }>(`/admin/matches?page=${currentPage}&limit=10`),
    keepPreviousData: true,
  });

  useEffect(() => {
    // If the current page is now beyond the total number of pages (e.g., after deleting the last item on the last page)
    if (
      !isLoading &&
      data &&
      data.totalPages > 0 &&
      currentPage > data.totalPages
    ) {
      setCurrentPage(data.totalPages);
    }
  }, [data, isLoading, currentPage]);

  const deleteMatchMutation = useMutation({
    mutationFn: (matchId: number) => api.delete(`/admin/matches/${matchId}`),
    onSuccess: (_, matchId) => {
      toast.success(`Match ${matchId} deleted successfully.`);
      queryClient.invalidateQueries({ queryKey: ["adminMatches"] });
      queryClient.invalidateQueries({ queryKey: ["adminDashboard"] });
    },
    onError: () => {
      toast.error("Failed to delete match.");
    },
  });

  const handleDeleteMatch = (matchId: number) => {
    if (
      window.confirm(
        `Are you sure you want to PERMANENTLY delete Match ID ${matchId}? This will resync all player stats and achievements involved.`
      )
    ) {
      deleteMatchMutation.mutate(matchId);
    }
  };

  const PaginationControls = () => {
    if (!data || data.totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 mt-4">
        <Button
          onClick={() => setCurrentPage(1)}
          disabled={data.currentPage === 1}
          className="p-2 h-auto"
        >
          <ChevronsLeft size={16} />
        </Button>
        <Button
          onClick={() => setCurrentPage((p) => p - 1)}
          disabled={data.currentPage === 1}
          className="p-2 h-auto"
        >
          <ChevronLeft size={16} />
        </Button>
        <span className="font-bold text-lg">
          Page {data.currentPage} of {data.totalPages}
        </span>
        <Button
          onClick={() => setCurrentPage((p) => p + 1)}
          disabled={data.currentPage === data.totalPages}
          className="p-2 h-auto"
        >
          <ChevronRight size={16} />
        </Button>
        <Button
          onClick={() => setCurrentPage(data.totalPages)}
          disabled={data.currentPage === data.totalPages}
          className="p-2 h-auto"
        >
          <ChevronsRight size={16} />
        </Button>
      </div>
    );
  };

  return (
    <Card>
      <h2 className="text-2xl font-bold mb-4">Game Management</h2>
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="p-2">Match ID</th>
                  <th className="p-2">Winner</th>
                  <th className="p-2">Played At</th>
                  <th className="p-2">Players</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.matches.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-slate-800 hover:bg-slate-800/50"
                  >
                    <td className="p-2 font-mono">#{m.id}</td>
                    <td
                      className={`p-2 font-bold ${
                        m.winner === "Good" ? "text-blue-400" : "text-red-400"
                      }`}
                    >
                      {m.winner}
                    </td>
                    <td className="p-2">
                      {new Date(m.played_at).toLocaleString()}
                    </td>
                    <td className="p-2 text-xs max-w-xs truncate">
                      {m.players?.join(", ") || "N/A"}
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        variant="danger"
                        className="p-2 h-auto"
                        onClick={() => handleDeleteMatch(m.id)}
                        disabled={deleteMatchMutation.isPending}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls />
          </>
        )}
      </div>
    </Card>
  );
};

const FriendshipsManagementTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: friendships, isLoading } = useQuery({
    queryKey: ["adminFriendships"],
    queryFn: () => fetcher<Friendship[]>("/admin/friendships"),
  });

  const deleteFriendshipMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/friendships/${id}`),
    onSuccess: () => {
      toast.success("Friendship deleted.");
      queryClient.invalidateQueries({ queryKey: ["adminFriendships"] });
    },
    onError: () => toast.error("Failed to delete friendship."),
  });

  const handleDeleteFriendship = (id: number) => {
    if (
      window.confirm(`Are you sure you want to delete friendship ID ${id}?`)
    ) {
      deleteFriendshipMutation.mutate(id);
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-bold mb-4">Friendships</h2>
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="p-2">ID</th>
                <th className="p-2">User 1</th>
                <th className="p-2">User 2</th>
                <th className="p-2">Status</th>
                <th className="p-2">Created At</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {friendships?.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-slate-800 hover:bg-slate-800/50"
                >
                  <td className="p-2 font-mono">#{f.id}</td>
                  <td className="p-2 font-semibold">{f.user1}</td>
                  <td className="p-2 font-semibold">{f.user2}</td>
                  <td
                    className={`p-2 font-bold ${
                      f.status === "accepted"
                        ? "text-green-400"
                        : "text-yellow-400"
                    }`}
                  >
                    {f.status}
                  </td>
                  <td className="p-2">
                    {new Date(f.created_at).toLocaleString()}
                  </td>
                  <td className="p-2 text-right">
                    <Button
                      variant="danger"
                      className="p-2 h-auto"
                      onClick={() => handleDeleteFriendship(f.id)}
                      disabled={deleteFriendshipMutation.isPending}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
};

const AdminPageContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const queryClient = useQueryClient();

  const [modal, setModal] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ["adminDashboard"],
    queryFn: () =>
      fetcher<{ userCount: number; matchCount: number; roomCount: number }>(
        "/admin/dashboard"
      ),
    enabled: activeTab === "dashboard",
  });
  const { data: users, isLoading: isUsersLoading } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: () => fetcher<AdminUser[]>("/admin/users"),
    enabled: activeTab === "users",
  });
  const { data: rooms, isLoading: isRoomsLoading } = useQuery({
    queryKey: ["adminRooms"],
    queryFn: () => fetcher<AdminRoom[]>("/admin/rooms"),
    enabled: activeTab === "rooms",
    refetchInterval: 5000,
  });
  const { data: allAchievements } = useQuery({
    queryKey: ["allAchievements"],
    queryFn: () => fetcher<AllAchievement[]>("/admin/achievements"),
    staleTime: Infinity,
  });

  // Mutations
  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => api.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      toast.success("User deleted.");
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
    },
    onError: () => toast.error("Failed to delete user."),
  });
  const closeRoomMutation = useMutation({
    mutationFn: (roomCode: string) => api.delete(`/admin/rooms/${roomCode}`),
    onSuccess: () => {
      toast.success("Room closed.");
      queryClient.invalidateQueries({ queryKey: ["adminRooms"] });
      queryClient.invalidateQueries({ queryKey: ["adminDashboard"] });
    },
    onError: () => toast.error("Failed to close room."),
  });

  const openStatEditor = (user: AdminUser) => {
    setSelectedUser(user);
    setModal("editStats");
  };
  const openAchievementGranter = (user: AdminUser) => {
    setSelectedUser(user);
    setModal("grantAchievement");
  };

  const StatCard = ({
    title,
    value,
    icon,
  }: {
    title: string;
    value: number;
    icon: React.ReactNode;
  }) => (
    <Card className="flex items-center p-4 gap-4">
      <div className="p-3 bg-slate-800 rounded-full">{icon}</div>
      <div>
        <p className="text-3xl font-bold text-white">{value}</p>
        <p className="text-slate-400">{title}</p>
      </div>
    </Card>
  );

  const EditStatsModal = () => {
    const { data: userStats, isLoading } = useQuery({
      queryKey: ["userStats", selectedUser?.id],
      queryFn: () =>
        fetcher<UserStat>(`/admin/users/${selectedUser!.id}/stats`),
      enabled: !!selectedUser,
    });
    const [stats, setStats] = useState<UserStat | null>(null);
    useEffect(() => {
      if (userStats) setStats(userStats);
    }, [userStats]);

    const updateStatsMutation = useMutation({
      mutationFn: (updatedStats: UserStat) =>
        api.put(`/admin/users/${selectedUser!.id}/stats`, updatedStats),
      onSuccess: () => {
        toast.success("Stats updated.");
        setModal(null);
      },
      onError: () => toast.error("Failed to update stats."),
    });

    const StatInput = ({
      label,
      name,
    }: {
      label: string;
      name: keyof UserStat;
    }) => (
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          {label}
        </label>
        <input
          type="number"
          value={stats?.[name] ?? ""}
          onChange={(e) =>
            setStats(
              (s) => s && { ...s, [name]: parseInt(e.target.value) || 0 }
            )
          }
          className="w-full bg-slate-800 p-2 rounded-md border border-slate-700"
          min="0"
        />
      </div>
    );

    if (!selectedUser) return null;
    return (
      <div
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        onClick={() => setModal(null)}
      >
        <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-bold mb-4">
            Edit Stats for {selectedUser.username}
          </h3>
          {isLoading || !stats ? (
            <div className="h-48 flex justify-center items-center">
              <Spinner />
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateStatsMutation.mutate(stats);
              }}
            >
              <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 p-3 bg-slate-800/50 rounded-lg">
                    <h4 className="font-bold text-yellow-400 mb-2">
                      Overall Pavalon Stats
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <StatInput label="Total Games" name="total_games" />
                      <StatInput label="Total Wins" name="total_wins" />
                    </div>
                  </div>
                  <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-800">
                    <h4 className="font-bold text-blue-400 mb-2">
                      Good Alignment
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      <StatInput label="Good Games" name="good_games" />
                      <StatInput label="Good Wins" name="good_wins" />
                    </div>
                  </div>
                  <div className="p-3 bg-red-900/20 rounded-lg border border-red-800">
                    <h4 className="font-bold text-red-400 mb-2">
                      Evil Alignment
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      <StatInput label="Evil Games" name="evil_games" />
                      <StatInput label="Evil Wins" name="evil_wins" />
                    </div>
                  </div>
                  <div className="md:col-span-2 p-3 bg-slate-800/50 rounded-lg">
                    <h4 className="font-bold text-yellow-400 mb-2">
                      Special Pavalon Stats
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <StatInput label="Current Win Streak" name="win_streak" />
                      <StatInput
                        label="Highest Win Streak"
                        name="highest_win_streak"
                      />
                      <StatInput label="Assassin Kills" name="assassin_kills" />
                    </div>
                  </div>
                  <div className="md:col-span-2 p-3 bg-orange-900/20 rounded-lg border border-orange-800">
                    <h4 className="font-bold text-orange-400 mb-2">
                      Dragon's Breath Stats
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <StatInput label="Defuses" name="db_defuses" />
                      <StatInput
                        label="Futures Played"
                        name="db_futures_played"
                      />
                      <StatInput
                        label="Attacks Played"
                        name="db_attacks_played"
                      />
                      <StatInput
                        label="Fillers Played"
                        name="db_fillers_played"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={updateStatsMutation.isPending}
                >
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setModal(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    );
  };

  const GrantAchievementModal = () => {
    const [achievementId, setAchievementId] = useState("");
    const grantAchievementMutation = useMutation({
      mutationFn: (id: string) =>
        api.post("/admin/achievements/grant", {
          userId: selectedUser!.id,
          achievementId: id,
        }),
      onSuccess: () => {
        toast.success("Achievement granted.");
        setModal(null);
      },
      onError: () => toast.error("Failed to grant achievement."),
    });
    if (!selectedUser) return null;
    return (
      <div
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
        onClick={() => setModal(null)}
      >
        <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-bold mb-4">
            Grant Achievement to {selectedUser.username}
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (achievementId) grantAchievementMutation.mutate(achievementId);
            }}
          >
            <select
              value={achievementId}
              onChange={(e) => setAchievementId(e.target.value)}
              className="w-full bg-slate-800 p-2 rounded-md mb-4"
            >
              <option value="">-- Select Achievement --</option>
              {allAchievements?.map((ach) => (
                <option key={ach.id} value={ach.id}>
                  {ach.name}
                </option>
              ))}
            </select>
            <div className="flex gap-4">
              <Button
                type="submit"
                className="flex-1"
                disabled={!achievementId || grantAchievementMutation.isPending}
              >
                Grant
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModal(null)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  };

  return (
    <div className="animate-fadeIn max-w-7xl mx-auto space-y-6 text-white">
      {modal &&
        (modal === "editStats" ? (
          <EditStatsModal />
        ) : (
          <GrantAchievementModal />
        ))}
      <h1
        className="font-eagleLake text-5xl text-center text-yellow-500"
        style={{ textShadow: "0 0 15px rgba(234, 179, 8, 0.4)" }}
      >
        Admin Panel
      </h1>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-slate-800/50 p-1 h-auto">
          <TabsTrigger value="dashboard" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold">
            <BarChart2 size={16} /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold">
            <Users size={16} /> Users
          </TabsTrigger>
          <TabsTrigger value="rooms" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold">
            <Gamepad2 size={16} /> Rooms
          </TabsTrigger>
          <TabsTrigger value="games" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold">
            <Swords size={16} /> Matches
          </TabsTrigger>
          <TabsTrigger value="friendships" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold">
            <Heart size={16} /> Friendships
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-6">
          {isDashboardLoading ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                title="Total Users"
                value={dashboardData!.userCount}
                icon={<Users size={24} />}
              />
              <StatCard
                title="Total Matches Played"
                value={dashboardData!.matchCount}
                icon={<Swords size={24} />}
              />
              <StatCard
                title="Active Rooms"
                value={dashboardData!.roomCount}
                icon={<Gamepad2 size={24} />}
              />
            </div>
          )}
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <Card>
            <h2 className="text-2xl font-bold mb-4">Users</h2>
            <div className="overflow-x-auto">
              {isUsersLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Spinner />
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="p-2">ID</th>
                      <th className="p-2">Username</th>
                      <th className="p-2">Created At</th>
                      <th className="p-2">Role</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users?.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-slate-800 hover:bg-slate-800/50"
                      >
                        <td className="p-2">{user.id}</td>
                        <td className="p-2 font-semibold">{user.username}</td>
                        <td className="p-2">
                          {new Date(user.created_at).toLocaleString()}
                        </td>
                        <td className="p-2">
                          {user.is_admin ? (
                            <span className="font-bold text-yellow-400">
                              Admin
                            </span>
                          ) : (
                            "Player"
                          )}
                        </td>
                        <td className="p-2 text-right space-x-2">
                          <Button
                            variant="secondary"
                            className="p-2 h-auto"
                            onClick={() => openStatEditor(user)}
                            title="Edit Stats"
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            variant="secondary"
                            className="p-2 h-auto"
                            onClick={() => openAchievementGranter(user)}
                            title="Grant Achievement"
                          >
                            <Award size={16} />
                          </Button>
                          <Button
                            variant="danger"
                            className="p-2 h-auto"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Are you sure you want to PERMANENTLY delete user ${user.username}? This is irreversible.`
                                )
                              )
                                deleteUserMutation.mutate(user.id);
                            }}
                            disabled={deleteUserMutation.isPending}
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="rooms" className="mt-6">
          <Card>
            <h2 className="text-2xl font-bold mb-4">Active Rooms</h2>
            <div className="overflow-x-auto">
              {isRoomsLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Spinner />
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="p-2">Code</th>
                      <th className="p-2">Players</th>
                      <th className="p-2">Phase</th>
                      <th className="p-2">Player List</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms?.map((room) => (
                      <tr
                        key={room.roomCode}
                        className="border-b border-slate-800 hover:bg-slate-800/50"
                      >
                        <td className="p-2 font-mono">{room.roomCode}</td>
                        <td className="p-2">{room.playerCount}</td>
                        <td className="p-2">{room.phase}</td>
                        <td className="p-2 text-xs max-w-xs truncate">
                          {room.players
                            .map((p) => `${p.name} (${p.status})`)
                            .join(", ")}
                        </td>
                        <td className="p-2 text-right">
                          <Button
                            variant="danger"
                            className="p-2 h-auto"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Force close room ${room.roomCode}? All players will be kicked.`
                                )
                              )
                                closeRoomMutation.mutate(room.roomCode);
                            }}
                            disabled={closeRoomMutation.isPending}
                            title="Close Room"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="games" className="mt-6">
          <GameManagementTab />
        </TabsContent>
        <TabsContent value="friendships" className="mt-6">
          <FriendshipsManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Guard component to protect the admin page
const AdminPage: React.FC = () => {
  const { user, isLoading } = useGame();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user?.is_admin) {
      toast.error("Access Denied", {
        description: "You must be an administrator to view this page.",
      });
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!user?.is_admin) {
    return (
      <Card className="text-center">
        <h2 className="text-3xl font-bold text-red-500">Access Denied</h2>
        <p className="text-slate-300 mt-2">
          You do not have permission to view this page.
        </p>
      </Card>
    );
  }
  return <AdminPageContent />;
};

export default AdminPage;
