import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { Friend, FriendRequest, GamePhase, FriendSuggestion } from '@/types';
import Button from './Button';
import Spinner from './Spinner';
import { X, Users, UserPlus, Mail, Gamepad2, Send, Check, Trash2, Gem } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ICON_MAP } from './AvailableIcons';
import Card from './Card';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { fetcher } from '@/services/api';


const FriendItem: React.FC<{ friend: Friend }> = React.memo(({ friend }) => {
    const { removeFriend, inviteFriendToGame, gameState, pendingInvites, acceptInvite } = useGame();
    const IconComponent = friend.selectedIcon ? ICON_MAP[friend.selectedIcon] : Gem;
    const borderClass = friend.selectedBorder ? `border-style-${friend.selectedBorder}` : 'border-slate-600';
    
    const pendingInvite = pendingInvites.find(inv => inv.from.id === friend.id);

    const handleRemove = useCallback(() => removeFriend(friend.id), [removeFriend, friend.id]);
    const handleInvite = useCallback(() => inviteFriendToGame(friend.id), [inviteFriendToGame, friend.id]);
    const handleAcceptInvite = useCallback(() => {
        if (pendingInvite) {
            acceptInvite(pendingInvite.roomCode);
        }
    }, [acceptInvite, pendingInvite]);
    
    const nonSwitchablePhases: (GamePhase | null)[] = [
        GamePhase.ROLE_REVEAL,
        GamePhase.TEAM_SELECTION,
        GamePhase.TEAM_VOTE,
        GamePhase.QUEST_VOTE,
        GamePhase.QUEST_RESULT,
        GamePhase.ASSASSINATION,
    ];
    const canAccept = !gameState.roomCode || !nonSwitchablePhases.includes(gameState.phase);

    const invitablePhases: (GamePhase | null)[] = [
        GamePhase.LOBBY,
        GamePhase.END_GAME,
        GamePhase.DRAGONS_BREATH,
        null
    ];
    
    const isAlreadyInRoom = gameState.roomCode && gameState.players.some(p => p.userId === friend.id);

    const isInvitable = friend.isOnline && 
        !isAlreadyInRoom &&
        (invitablePhases.includes(friend.gamePhase ?? null)) &&
        gameState.phase === GamePhase.LOBBY;

    const getStatusText = () => {
        if (!friend.isOnline) return 'Offline';
        if (isAlreadyInRoom) return 'In your party';
        if (friend.isInGame) {
            switch(friend.gamePhase) {
                case GamePhase.LOBBY: return 'In Lobby';
                case GamePhase.DRAGONS_BREATH: return "Dragon's Breath";
                case null: return 'In Game';
                default: return 'In Game';
            }
        }
        return 'Online';
    }

    return (
        <div className="flex items-center justify-between p-2 sm:p-3 bg-slate-800/60 rounded-lg transition-colors hover:bg-slate-800">
            <div className="flex items-center gap-3 min-w-0">
                 <div className={cn(
                    `relative w-12 h-12 rounded-lg border-2 bg-slate-900/50 flex items-center justify-center flex-shrink-0`,
                    borderClass
                 )}>
                    <IconComponent className="w-8 h-8 text-slate-300" />
                     {friend.isOnline && (
                        <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center">
                            <div className="relative w-3 h-3 flex items-center justify-center">
                                <span className="absolute inset-0 rounded-full bg-green-400/80 blur-sm animate-pulse"></span>
                                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="min-w-0">
                    <p className="font-bold text-white truncate">{friend.username}</p>
                    <div className="flex items-center gap-1.5 text-xs">
                        <span className={friend.isOnline ? 'text-green-400' : 'text-slate-500'}>
                             {getStatusText()}
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                 {pendingInvite ? (
                    <Button 
                        variant="icon-success" 
                        onClick={handleAcceptInvite}
                        disabled={!canAccept}
                        className="w-10 h-10 p-0 flex items-center justify-center" 
                        title={canAccept ? `Join ${friend.username}'s game` : "Cannot accept, you are in a game."}
                    >
                        <Gamepad2 size={20} />
                    </Button>
                ) : isInvitable ? (
                    <Button variant="icon-primary" onClick={handleInvite} className="w-10 h-10 p-0 flex items-center justify-center" title="Invite to Game">
                        <Gamepad2 size={20} />
                    </Button>
                ) : null}
                <Button variant="icon-danger" onClick={handleRemove} className="w-10 h-10 p-0 flex items-center justify-center" title="Remove Friend">
                    <Trash2 size={20} />
                </Button>
            </div>
        </div>
    );
});

const RequestItem: React.FC<{ request: FriendRequest }> = React.memo(({ request }) => {
    const { respondToFriendRequest } = useGame();
    const handleAccept = useCallback(() => respondToFriendRequest(request.id, 'accept'), [respondToFriendRequest, request.id]);
    const handleDecline = useCallback(() => respondToFriendRequest(request.id, 'decline'), [respondToFriendRequest, request.id]);

    return (
        <div className="flex items-center justify-between p-2 sm:p-3 bg-slate-800/60 rounded-lg">
            <p className="font-bold text-white">{request.username}</p>
            <div className="flex items-center gap-2">
                <Button variant="icon-success" onClick={handleAccept} className="w-10 h-10 p-0 flex items-center justify-center" title="Accept Request">
                    <Check size={20} />
                </Button>
                <Button variant="icon-danger" onClick={handleDecline} className="w-10 h-10 p-0 flex items-center justify-center" title="Decline Request">
                    <X size={20} />
                </Button>
            </div>
        </div>
    );
});

const SentRequestItem: React.FC<{ request: FriendRequest }> = React.memo(({ request }) => {
    const { cancelFriendRequest } = useGame();
    const handleCancel = useCallback(() => cancelFriendRequest(request.id), [cancelFriendRequest, request.id]);

    return (
        <div className="flex items-center justify-between p-2 sm:p-3 bg-slate-800/60 rounded-lg">
            <p className="font-bold text-white">{request.username}</p>
            <Button variant="secondary" onClick={handleCancel} className="p-2 h-auto text-sm" title="Cancel Request">
                Cancel
            </Button>
        </div>
    );
});

const SuggestionItem: React.FC<{ suggestion: FriendSuggestion, onAdd: (username: string) => Promise<void> }> = React.memo(({ suggestion, onAdd }) => {
    const [isAdding, setIsAdding] = useState(false);

    const handleAdd = useCallback(async () => {
        setIsAdding(true);
        await onAdd(suggestion.username);
    }, [onAdd, suggestion.username]);

    return (
        <div className="flex items-center justify-between p-2 sm:p-3 bg-slate-800/60 rounded-lg">
            <div>
                <p className="font-bold text-white">{suggestion.username}</p>
                <p className="text-xs text-slate-400">{suggestion.mutual_friends} mutual friend{suggestion.mutual_friends > 1 ? 's' : ''}</p>
            </div>
            <Button
                variant="icon-success"
                onClick={handleAdd}
                disabled={isAdding}
                className="w-10 h-10 p-0 flex items-center justify-center"
                title={`Add ${suggestion.username}`}
            >
                {isAdding ? <Spinner size="sm" /> : <UserPlus size={20} />}
            </Button>
        </div>
    );
});


const EmptyState: React.FC<{ icon: React.ReactNode, title: string, message: string }> = ({ icon, title, message }) => (
    <div className="flex flex-col items-center justify-center text-center text-slate-500 py-8 sm:py-12">
        <div className="mb-4">{icon}</div>
        <h3 className="font-bold text-lg text-slate-400">{title}</h3>
        <p className="text-sm max-w-xs">{message}</p>
    </div>
);

const SkeletonItem: React.FC = () => (
    <div className="flex animate-pulse items-center justify-between p-2 sm:p-3 bg-slate-800/60 rounded-lg">
        <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-slate-600 flex-shrink-0" />
            <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-slate-800/20" />
                <div className="h-3 w-16 rounded bg-slate-800/20" />
            </div>
        </div>
        <div className="w-10 h-10 rounded bg-slate-600/40" />
    </div>
);


const SocialHubContent: React.FC<{ onClose?: () => void, asScreen?: boolean }> = ({ onClose, asScreen }) => {
    const { friendRequests, addFriend } = useGame();
    const [activeTab, setActiveTab] = useState('friends');
    const [newFriendName, setNewFriendName] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const { data: friends = [], isLoading: isFriendsLoading } = useQuery({
        queryKey: ['friends'],
        queryFn: () => fetcher<Friend[]>('/social/friends'),
    });

    const { data: sentFriendRequests = [], isLoading: isSentRequestsLoading } = useQuery({
        queryKey: ['sentFriendRequests'],
        queryFn: () => fetcher<FriendRequest[]>('/social/requests/sent'),
        enabled: activeTab === 'requests',
    });

    const { data: suggestions = [], isLoading: isSuggestionsLoading } = useQuery({
        queryKey: ['suggestions'],
        queryFn: () => fetcher<FriendSuggestion[]>('/social/suggestions'),
        enabled: activeTab === 'add',
    });

    const handleAddFriend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFriendName.trim() || isAdding) return;
        setIsAdding(true);
        await addFriend(newFriendName.trim());
        setNewFriendName('');
        setIsAdding(false);
    };

    return (
        <Card className={cn(
            "flex flex-col",
            asScreen ? "bg-transparent border-none shadow-none p-0" : "p-3 sm:p-4 md:p-6 h-[85vh] max-h-[700px]"
        )}>
            <div className="flex justify-between items-center mb-4">
                <h1 className="font-eagleLake text-2xl sm:text-3xl text-yellow-500">Social Hub</h1>
                {!asScreen && onClose && (
                    <Button variant="icon-danger" onClick={onClose} className="w-10 h-10 p-0 flex items-center justify-center rounded-full"><X size={20} /></Button>
                )}
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-grow">
                <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 p-1 h-auto rounded-lg mb-4">
                    <TabsTrigger value="friends" className="flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold text-xs sm:text-sm">
                        <Users size={16} /> Friends ({friends.length})
                    </TabsTrigger>
                    <TabsTrigger value="requests" className="relative flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold text-xs sm:text-sm">
                        <Mail size={16} /> Requests
                        {friendRequests.length > 0 && (
                            <span className="absolute top-1 right-1 w-5 h-5 text-xs flex items-center justify-center bg-blue-500 text-white font-sans font-bold rounded-full">
                                {friendRequests.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="add" className="flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold text-xs sm:text-sm">
                        <UserPlus size={16} /> Add
                    </TabsTrigger>
                </TabsList>
                
                <div className="flex-grow overflow-y-auto pr-2 scroll-hide">
                    <TabsContent value="friends" className="m-0 space-y-2">
                         {isFriendsLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 3 }).map((_, i) => <SkeletonItem key={i} />)}
                            </div>
                         ) : (
                            friends.length > 0 ? friends.map(f => <FriendItem key={f.id} friend={f} />) : <EmptyState icon={<Users size={48} />} title="Your friends list is empty" message="Use the 'Add' tab to find and add friends by their username."/>
                         )}
                    </TabsContent>
                    <TabsContent value="requests" className="m-0 space-y-4">
                        <div>
                            <h3 className="font-bold text-lg text-yellow-400 mb-2">Received Requests</h3>
                            {friendRequests.length > 0 ? (
                                <div className="space-y-2">
                                    {friendRequests.map(r => <RequestItem key={r.id} request={r} />)}
                                </div>
                            ) : <EmptyState icon={<Mail size={48} />} title="No pending requests" message="You have no new friend requests at this time."/>}
                        </div>
                        <div className="pt-4 border-t border-slate-700">
                             <h3 className="font-bold text-lg text-yellow-400 mb-2">Sent Requests</h3>
                             {isSentRequestsLoading ? (
                                 <div className="space-y-2">
                                    {Array.from({ length: 2 }).map((_, i) => <SkeletonItem key={i} />)}
                                </div>
                             ) : (
                                 sentFriendRequests.length > 0 ? (
                                    <div className="space-y-2">
                                        {sentFriendRequests.map(r => <SentRequestItem key={r.id} request={r} />)}
                                    </div>
                                 ) : <EmptyState icon={<Send size={48} />} title="No sent requests" message="You haven't sent any friend requests that are still pending."/>
                             )}
                        </div>
                    </TabsContent>
                    <TabsContent value="add" className="m-0 pt-4 space-y-6">
                        <form onSubmit={handleAddFriend} className="space-y-4">
                            <input
                                type="text"
                                value={newFriendName}
                                onChange={e => setNewFriendName(e.target.value)}
                                placeholder="Enter username..."
                                className="w-full bg-slate-800 border-2 border-slate-700 rounded-lg p-3 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-yellow-600 transition"
                            />
                            <Button type="submit" className="w-full flex items-center justify-center gap-2 text-lg py-3" disabled={isAdding || !newFriendName.trim()}>
                                {isAdding ? <Spinner size="sm" /> : <><UserPlus size={20} /> Send Request</>}
                            </Button>
                        </form>
                        <div className="border-t border-slate-700 pt-4">
                            <h3 className="font-bold text-lg text-yellow-400 mb-2">People You May Know</h3>
                             {isSuggestionsLoading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 3 }).map((_, i) => <SkeletonItem key={i} />)}
                                </div>
                             ) : (
                                suggestions.length > 0 ? (
                                    <div className="space-y-2">
                                        {suggestions.map(s => (
                                            <SuggestionItem 
                                                key={s.id} 
                                                suggestion={s}
                                                onAdd={addFriend}
                                            />
                                        ))}
                                    </div>
                                ) : <EmptyState icon={<Users size={48} />} title="No Suggestions" message="We couldn't find any friend suggestions for you right now. Try adding more friends!" />
                            )}
                        </div>
                    </TabsContent>
                </div>
            </Tabs>
        </Card>
    );
};

const SocialHub: React.FC<{ onClose?: () => void; asScreen?: boolean; }> = ({ onClose, asScreen = false }) => {
    if (asScreen) {
        return <SocialHubContent asScreen />;
    }
    
    // Modal implementation
    return (
        <motion.div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="w-full max-w-2xl"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onClick={e => e.stopPropagation()}
            >
                <SocialHubContent onClose={onClose} />
            </motion.div>
        </motion.div>
    );
};


export default SocialHub;