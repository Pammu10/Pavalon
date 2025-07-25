

"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '@/components/context/GameContext';
import api from '@/services/api';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Swords, BarChart2, Gamepad2, Trash2, Edit, Award, ShieldCheck, ShieldAlert, KeyRound, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';

// --- Types for Admin Panel ---
type AdminUser = { id: number; username: string; created_at: string; is_admin: boolean; };
type AdminRoom = { roomCode: string; playerCount: number; phase: string; players: { name: string; status: string; }[]; };
type AllAchievement = { id: string; name: string; };
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
type AdminMatch = { id: number; winner: string; played_at: string; players: string[] | null; };

// --- Sub-components for Admin Panel ---

const GameManagementTab: React.FC = () => {
    const [data, setData] = useState<{ matches: AdminMatch[], totalPages: number, currentPage: number }>({ matches: [], totalPages: 1, currentPage: 1 });
    const [loading, setLoading] = useState(true);

    const fetchMatches = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/matches?page=${page}&limit=10`);
            setData(res.data);
        } catch (error) {
            toast.error("Failed to fetch matches.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    const handleDeleteMatch = async (matchId: number) => {
        if (window.confirm(`Are you sure you want to PERMANENTLY delete Match ID ${matchId}? This will resync all player stats and achievements involved.`)) {
            try {
                await api.delete(`/admin/matches/${matchId}`);
                toast.success(`Match ${matchId} deleted successfully.`);
                fetchMatches(data.currentPage);
            } catch (error) {
                toast.error("Failed to delete match.");
            }
        }
    };

    const PaginationControls = () => (
        <div className="flex items-center justify-center gap-2 mt-4">
            <Button onClick={() => fetchMatches(1)} disabled={data.currentPage === 1} className="p-2 h-auto"><ChevronsLeft size={16}/></Button>
            <Button onClick={() => fetchMatches(data.currentPage - 1)} disabled={data.currentPage === 1} className="p-2 h-auto"><ChevronLeft size={16}/></Button>
            <span className="font-bold text-lg">Page {data.currentPage} of {data.totalPages}</span>
            <Button onClick={() => fetchMatches(data.currentPage + 1)} disabled={data.currentPage === data.totalPages} className="p-2 h-auto"><ChevronRight size={16}/></Button>
            <Button onClick={() => fetchMatches(data.totalPages)} disabled={data.currentPage === data.totalPages} className="p-2 h-auto"><ChevronsRight size={16}/></Button>
        </div>
    );
    
    return (
        <Card>
            <h2 className="text-2xl font-bold mb-4">Game Management</h2>
            <div className="overflow-x-auto">
                {loading ? <div className="h-64 flex items-center justify-center"><Spinner /></div> : (
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
                                {data.matches.map(m => (
                                    <tr key={m.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                        <td className="p-2 font-mono">#{m.id}</td>
                                        <td className={`p-2 font-bold ${m.winner === 'Good' ? 'text-blue-400' : 'text-red-400'}`}>{m.winner}</td>
                                        <td className="p-2">{new Date(m.played_at).toLocaleString()}</td>
                                        <td className="p-2 text-xs max-w-xs truncate">{m.players?.join(', ') || 'N/A'}</td>
                                        <td className="p-2 text-right">
                                            <Button variant="danger" className="p-2 h-auto" onClick={() => handleDeleteMatch(m.id)}><Trash2 size={16}/></Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {data.totalPages > 1 && <PaginationControls />}
                    </>
                )}
            </div>
        </Card>
    );
};


// --- Main Admin Panel Component ---
const AdminPageContent: React.FC = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [dashboardData, setDashboardData] = useState({ userCount: 0, matchCount: 0, roomCount: 0 });
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [rooms, setRooms] = useState<AdminRoom[]>([]);
    const [allAchievements, setAllAchievements] = useState<AllAchievement[]>([]);
    const [loading, setLoading] = useState({ dashboard: true, users: true, rooms: true });
    
    const [modal, setModal] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [userStats, setUserStats] = useState<UserStat | null>(null);

    const fetchData = useCallback(async (tab: string) => {
        setLoading(prev => ({ ...prev, [tab]: true }));
        try {
            switch (tab) {
                case 'dashboard':
                    const dashRes = await api.get('/admin/dashboard');
                    setDashboardData(dashRes.data);
                    break;
                case 'users':
                    const usersRes = await api.get('/admin/users');
                    setUsers(usersRes.data);
                    const achievementsRes = await api.get('/admin/achievements');
                    setAllAchievements(achievementsRes.data);
                    break;
                case 'rooms':
                    const roomsRes = await api.get('/admin/rooms');
                    setRooms(roomsRes.data);
                    break;
            }
        } catch (error) {
            toast.error(`Failed to load ${tab} data.`);
        } finally {
            setLoading(prev => ({ ...prev, [tab]: false }));
        }
    }, []);

    useEffect(() => {
        fetchData(activeTab);
    }, [activeTab, fetchData]);

    // Handlers for actions
    const handleDeleteUser = async (user: AdminUser) => {
        if (window.confirm(`Are you sure you want to delete ${user.username}? This is irreversible.`)) {
            try {
                await api.delete(`/admin/users/${user.id}`);
                toast.success('User deleted successfully.');
                fetchData('users');
            } catch (error) {
                toast.error('Failed to delete user.');
            }
        }
    };

    const handleCloseRoom = async (roomCode: string) => {
        if (window.confirm(`Are you sure you want to force-close room ${roomCode}?`)) {
            try {
                await api.delete(`/admin/rooms/${roomCode}`);
                toast.success('Room closed successfully.');
                fetchData('rooms');
                fetchData('dashboard'); // Refresh room count
            } catch (error) {
                toast.error('Failed to close room.');
            }
        }
    };

    const openStatEditor = async (user: AdminUser) => {
        setSelectedUser(user);
        setUserStats(null);
        setModal('editStats');
        try {
            const res = await api.get(`/admin/users/${user.id}/stats`);
            setUserStats(res.data);
        } catch (error) {
            toast.error("Failed to load user stats.");
            setModal(null);
        }
    };
    
    const openAchievementGranter = (user: AdminUser) => {
        setSelectedUser(user);
        setModal('grantAchievement');
    };
    
    // UI Components
    const StatCard = ({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) => (
        <Card className="flex items-center p-4 gap-4">
            <div className="p-3 bg-slate-800 rounded-full">{icon}</div>
            <div>
                <p className="text-3xl font-bold text-white">{value}</p>
                <p className="text-slate-400">{title}</p>
            </div>
        </Card>
    );
    
    const renderModals = () => {
        if (!selectedUser) return null;

        const EditStatsModal = () => {
            const StatInput = ({ label, name }: { label: string; name: keyof UserStat }) => (
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
                    <input 
                        type="number" 
                        value={userStats?.[name] ?? ''} 
                        onChange={e => setUserStats(s => s && ({ ...s, [name]: parseInt(e.target.value) || 0 }))} 
                        className="w-full bg-slate-800 p-2 rounded-md border border-slate-700"
                        min="0"
                    />
                </div>
            );

            return (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
                    <Card className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">Edit Stats for {selectedUser.username}</h3>
                        {userStats ? (
                            <form onSubmit={async e => {
                                e.preventDefault();
                                const statsToSend = Object.entries(userStats).reduce((acc, [key, value]) => {
                                    acc[key as keyof UserStat] = Number(value) || 0;
                                    return acc;
                                }, {} as UserStat);
        
                                try {
                                    await api.put(`/admin/users/${selectedUser.id}/stats`, statsToSend);
                                    toast.success("Stats updated successfully.");
                                    setModal(null);
                                } catch (error) {
                                    toast.error("Failed to update stats.");
                                }
                            }}>
                                <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-2">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2 p-3 bg-slate-800/50 rounded-lg">
                                            <h4 className="font-bold text-yellow-400 mb-2">Overall Pavalon Stats</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <StatInput label="Total Games" name="total_games" />
                                                <StatInput label="Total Wins" name="total_wins" />
                                            </div>
                                        </div>
                                        <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-800">
                                             <h4 className="font-bold text-blue-400 mb-2">Good Alignment</h4>
                                             <div className="grid grid-cols-1 gap-4">
                                                <StatInput label="Good Games" name="good_games" />
                                                <StatInput label="Good Wins" name="good_wins" />
                                             </div>
                                        </div>
                                        <div className="p-3 bg-red-900/20 rounded-lg border border-red-800">
                                             <h4 className="font-bold text-red-400 mb-2">Evil Alignment</h4>
                                             <div className="grid grid-cols-1 gap-4">
                                                <StatInput label="Evil Games" name="evil_games" />
                                                <StatInput label="Evil Wins" name="evil_wins" />
                                             </div>
                                        </div>
                                        <div className="md:col-span-2 p-3 bg-slate-800/50 rounded-lg">
                                            <h4 className="font-bold text-yellow-400 mb-2">Special Pavalon Stats</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <StatInput label="Current Win Streak" name="win_streak" />
                                                <StatInput label="Highest Win Streak" name="highest_win_streak" />
                                                <StatInput label="Assassin Kills" name="assassin_kills" />
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 p-3 bg-orange-900/20 rounded-lg border border-orange-800">
                                            <h4 className="font-bold text-orange-400 mb-2">Dragon's Breath Stats</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <StatInput label="Defuses" name="db_defuses" />
                                                <StatInput label="Futures Played" name="db_futures_played" />
                                                <StatInput label="Attacks Played" name="db_attacks_played" />
                                                <StatInput label="Fillers Played" name="db_fillers_played" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-4 mt-6">
                                    <Button type="submit" className="flex-1">Save Changes</Button>
                                    <Button type="button" variant="secondary" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                                </div>
                            </form>
                        ) : <div className="h-48 flex justify-center items-center"><Spinner /></div>}
                    </Card>
                </div>
            )
        };

        const GrantAchievementModal = () => {
            const [achievementId, setAchievementId] = useState('');
            return (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setModal(null)}>
                    <Card className="w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">Grant Achievement to {selectedUser.username}</h3>
                        <form onSubmit={async e => {
                            e.preventDefault();
                            if (!achievementId) return toast.error("Please select an achievement.");
                            try {
                                await api.post('/admin/achievements/grant', { userId: selectedUser.id, achievementId });
                                toast.success("Achievement granted.");
                                setModal(null);
                            } catch (error) {
                                toast.error("Failed to grant achievement.");
                            }
                        }}>
                             <select value={achievementId} onChange={e => setAchievementId(e.target.value)} className="w-full bg-slate-800 p-2 rounded-md mb-4">
                                <option value="">-- Select Achievement --</option>
                                {allAchievements.map(ach => <option key={ach.id} value={ach.id}>{ach.name}</option>)}
                            </select>
                            <div className="flex gap-4">
                                <Button type="submit" className="flex-1">Grant</Button>
                                <Button type="button" variant="secondary" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )
        };
        
        if (modal === 'editStats') return <EditStatsModal />;
        if (modal === 'grantAchievement') return <GrantAchievementModal />;
        return null;
    }

    return (
        <div className="animate-fadeIn max-w-7xl mx-auto space-y-6 text-white">
            {renderModals()}
            <h1 className="font-eagleLake text-5xl text-center text-yellow-500" style={{ textShadow: "0 0 15px rgba(234, 179, 8, 0.4)" }}>Admin Panel</h1>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-slate-800/50 p-1 h-auto">
                    <TabsTrigger value="dashboard" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold">
                        <BarChart2 size={16}/> Dashboard
                    </TabsTrigger>
                    <TabsTrigger value="users" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold">
                        <Users size={16}/> User Management
                    </TabsTrigger>
                    <TabsTrigger value="rooms" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold">
                        <Gamepad2 size={16}/> Room Management
                    </TabsTrigger>
                     <TabsTrigger value="games" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold">
                        <Swords size={16}/> Game Management
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="mt-6">
                    {loading.dashboard ? <Spinner /> : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatCard title="Total Users" value={dashboardData.userCount} icon={<Users size={24}/>}/>
                            <StatCard title="Total Matches Played" value={dashboardData.matchCount} icon={<Swords size={24}/>}/>
                            <StatCard title="Active Rooms" value={dashboardData.roomCount} icon={<Gamepad2 size={24}/>}/>
                        </div>
                    )}
                </TabsContent>
                <TabsContent value="users" className="mt-6">
                     <Card>
                        <h2 className="text-2xl font-bold mb-4">Users</h2>
                        <div className="overflow-x-auto">
                            {loading.users ? <Spinner /> : (
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-700">
                                            <th className="p-2">ID</th>
                                            <th className="p-2">Username</th>
                                            <th className="p-2">Joined</th>
                                            <th className="p-2">Status</th>
                                            <th className="p-2 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => (
                                            <tr key={u.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                                <td className="p-2">{u.id}</td>
                                                <td className="p-2 font-semibold">{u.username}</td>
                                                <td className="p-2">{new Date(u.created_at).toLocaleDateString()}</td>
                                                <td className="p-2">{u.is_admin ? <ShieldCheck className="text-green-400" /> : <ShieldAlert className="text-slate-500" />}</td>
                                                <td className="p-2 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <Button variant="secondary" className="p-2 h-auto" onClick={() => openStatEditor(u)}><Edit size={16}/></Button>
                                                        <Button variant="secondary" className="p-2 h-auto" onClick={() => openAchievementGranter(u)}><Award size={16}/></Button>
                                                        <Button variant="danger" className="p-2 h-auto" onClick={() => handleDeleteUser(u)}><Trash2 size={16}/></Button>
                                                    </div>
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
                            {loading.rooms ? <Spinner /> : (
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-700">
                                            <th className="p-2">Room Code</th>
                                            <th className="p-2">Players</th>
                                            <th className="p-2">Phase</th>
                                            <th className="p-2">Player List</th>
                                            <th className="p-2 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rooms.map(r => (
                                            <tr key={r.roomCode} className="border-b border-slate-800 hover:bg-slate-800/50">
                                                <td className="p-2 font-mono"><KeyRound size={14} className="inline mr-2"/>{r.roomCode}</td>
                                                <td className="p-2">{r.playerCount}</td>
                                                <td className="p-2">{r.phase}</td>
                                                <td className="p-2 text-xs">{r.players.map(p => p.name).join(', ')}</td>
                                                <td className="p-2 text-right">
                                                    <Button variant="danger" onClick={() => handleCloseRoom(r.roomCode)}>Close Room</Button>
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
            </Tabs>
        </div>
    )
};

// Guard component to protect the admin page
const AdminPage: React.FC = () => {
    const { user, isLoading } = useGame();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user?.is_admin) {
           toast.error("Access Denied", { description: "You must be an administrator to view this page."});
           // In a real app with page-based routing, you'd redirect.
           // Since this is a single page app experience, we can just show a message or do nothing.
           // For now, this component is part of a Tab, so the user can just click away.
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
    }

    if (!user?.is_admin) {
        return (
            <Card className="text-center">
                <h2 className="text-3xl font-bold text-red-500">Access Denied</h2>
                <p className="text-slate-300 mt-2">You do not have permission to view this page.</p>
            </Card>
        );
    }

    return <AdminPageContent />;
};


export default AdminPage;