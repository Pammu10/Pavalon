import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Friend, FriendRequest, GamePhase } from '@/types';
import Button from './Button';
import Spinner from './Spinner';
import { X, Users, UserPlus, Mail, Gamepad2, Send, Check, Trash2, Gem } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ICON_MAP } from './AvailableIcons';
import Card from './Card';
import { motion } from 'framer-motion';


const FriendItem: React.FC<{ friend: Friend }> = ({ friend }) => {
    const { removeFriend, inviteFriendToGame, gameState, user, pendingInvites, acceptInvite } = useGame();
    const IconComponent = friend.selectedIcon ? ICON_MAP[friend.selectedIcon] : Gem;
    const borderClass = friend.selectedBorder ? `border-style-${friend.selectedBorder}` : 'border-slate-600';
    
    const pendingInvite = pendingInvites.find(inv => inv.from.id === friend.id);
    const canAccept = !gameState.roomCode;

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


    return (
        <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg">
            <div className="flex items-center gap-3">
                 <div className={`relative w-12 h-12 rounded-lg border-2 ${borderClass} bg-slate-900/50 flex items-center justify-center flex-shrink-0`}>
                    <IconComponent className="w-8 h-8 text-slate-300" />
                </div>
                <div>
                    <p className="font-bold text-white">{friend.username}</p>
                    <div className="flex items-center gap-1.5 text-xs">
                        <span className={`w-2 h-2 rounded-full ${friend.isOnline ? 'bg-green-400' : 'bg-slate-500'}`}></span>
                        <span className={friend.isOnline ? 'text-green-400' : 'text-slate-500'}>
                             {friend.isOnline ? (isAlreadyInRoom ? 'In Party' : (friend.gamePhase ? friend.gamePhase : 'Online')) : 'Offline'}
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                 {pendingInvite ? (
                    <Button 
                        variant="success" 
                        onClick={() => acceptInvite(pendingInvite.roomCode)}
                        disabled={!canAccept}
                        className="p-2 h-auto animate-pulse-glow" 
                        title={canAccept ? `Join ${friend.username}'s game` : "Cannot accept, you are in a game."}
                    >
                        <Gamepad2 size={16} />
                    </Button>
                ) : isInvitable ? (
                    <Button onClick={() => inviteFriendToGame(friend.id)} className="p-2 h-auto" title="Invite to Game">
                        <Gamepad2 size={16} />
                    </Button>
                ) : null}
                <Button variant="danger" onClick={() => removeFriend(friend.id)} className="p-2 h-auto" title="Remove Friend">
                    <Trash2 size={16} />
                </Button>
            </div>
        </div>
    );
};

const RequestItem: React.FC<{ request: FriendRequest }> = ({ request }) => {
    const { respondToFriendRequest } = useGame();
    return (
        <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg">
            <p className="font-bold text-white">{request.username}</p>
            <div className="flex items-center gap-2">
                <Button variant="success" onClick={() => respondToFriendRequest(request.id, 'accept')} className="p-2 h-auto" title="Accept Request">
                    <Check size={16} />
                </Button>
                <Button variant="danger" onClick={() => respondToFriendRequest(request.id, 'decline')} className="p-2 h-auto" title="Decline Request">
                    <X size={16} />
                </Button>
            </div>
        </div>
    );
};

const SentRequestItem: React.FC<{ request: FriendRequest }> = ({ request }) => {
    const { cancelFriendRequest } = useGame();
    return (
        <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg">
            <p className="font-bold text-white">{request.username}</p>
            <Button variant="danger" onClick={() => cancelFriendRequest(request.id)} className="p-2 h-auto flex items-center gap-1.5 text-sm" title="Cancel Request">
                <X size={16} /> Cancel
            </Button>
        </div>
    );
};

const SocialHubContent: React.FC<{ onClose?: () => void, asScreen?: boolean }> = ({ onClose, asScreen }) => {
    const { friends, friendRequests, sentFriendRequests, addFriend } = useGame();
    const [activeTab, setActiveTab] = useState('friends');
    const [newFriendName, setNewFriendName] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const handleAddFriend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFriendName.trim() || isAdding) return;
        setIsAdding(true);
        await addFriend(newFriendName.trim());
        setNewFriendName('');
        setIsAdding(false);
    };

    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h1 className="font-eagleLake text-3xl text-yellow-500">Social Hub</h1>
                {!asScreen && onClose && (
                    <Button variant="danger" onClick={onClose} className="p-2 h-auto rounded-full aspect-square"><X size={20} /></Button>
                )}
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 p-1 h-auto rounded-lg mb-4">
                    <TabsTrigger value="friends" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold">
                        <Users size={16} /> Friends ({friends.length})
                    </TabsTrigger>
                    <TabsTrigger value="requests" className="relative flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold">
                        <Mail size={16} /> Requests
                        {friendRequests.length > 0 && (
                            <span className="absolute top-1 right-1 w-5 h-5 text-xs flex items-center justify-center bg-blue-500 text-white font-sans font-bold rounded-full">
                                {friendRequests.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="add" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold">
                        <UserPlus size={16} /> Add Friend
                    </TabsTrigger>
                </TabsList>
                
                <div className="min-h-[400px] max-h-[60vh] overflow-y-auto pr-2 scroll-hide">
                    <TabsContent value="friends" className="m-0 space-y-2">
                        {friends.length > 0 ? friends.map(f => <FriendItem key={f.id} friend={f} />) : <p className="text-center text-slate-400 p-8">Your friends list is empty. Add some friends to get started!</p>}
                    </TabsContent>
                    <TabsContent value="requests" className="m-0 space-y-4">
                        <div>
                            <h3 className="font-bold text-lg text-yellow-400 mb-2">Received Requests</h3>
                            {friendRequests.length > 0 ? (
                                <div className="space-y-2">
                                    {friendRequests.map(r => <RequestItem key={r.id} request={r} />)}
                                </div>
                            ) : <p className="text-center text-slate-400 p-4">No pending friend requests.</p>}
                        </div>
                        <div className="pt-4 border-t border-slate-700">
                             <h3 className="font-bold text-lg text-yellow-400 mb-2">Sent Requests</h3>
                             {sentFriendRequests.length > 0 ? (
                                <div className="space-y-2">
                                    {sentFriendRequests.map(r => <SentRequestItem key={r.id} request={r} />)}
                                </div>
                             ) : <p className="text-center text-slate-400 p-4">You have no pending sent requests.</p>}
                        </div>
                    </TabsContent>
                    <TabsContent value="add" className="m-0">
                        <form onSubmit={handleAddFriend} className="space-y-4">
                            <input
                                type="text"
                                value={newFriendName}
                                onChange={e => setNewFriendName(e.target.value)}
                                placeholder="Enter username..."
                                className="w-full bg-slate-800 border-2 border-slate-700 rounded-lg p-3 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-yellow-600 transition"
                            />
                            <Button type="submit" className="w-full flex items-center justify-center gap-2" disabled={isAdding || !newFriendName.trim()}>
                                {isAdding ? <Spinner size="sm" /> : <><Send size={16} /> Send Request</>}
                            </Button>
                        </form>
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