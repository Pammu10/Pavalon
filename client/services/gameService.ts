import { GameState, Player, GamePhase, Role, Alignment, Quest } from '@/types';
import { ROLE_CONFIGURATIONS, QUEST_CONFIGURATIONS, ROLES } from '@/constants';
import type { socketService as SocketServiceType } from './socketService';

export class GameService {
    /*
    This class contained server-side game logic that is not used by the client application.
    The implementation has been commented out to resolve compilation errors. The client 
    interacts with the server via GameContext and socketService, and the server's 
    GameService in server.ts handles the actual game logic.
    */
}
