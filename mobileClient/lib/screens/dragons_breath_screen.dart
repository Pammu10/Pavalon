import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../services/audio_service.dart';
import '../services/haptics.dart';
import '../state/game_provider.dart';
import '../widgets/common.dart';

const _cardImages = {
  DragonCardType.dragonBreath: 'assets/cards/dragon_breath.jpg',
  DragonCardType.defuse: 'assets/cards/defuse.jpg',
  DragonCardType.attack: 'assets/cards/attack.jpg',
  DragonCardType.skip: 'assets/cards/skip.jpg',
  DragonCardType.seeTheFuture: 'assets/cards/see_the_future.jpg',
  DragonCardType.shuffle: 'assets/cards/shuffle.jpg',
  DragonCardType.emberdrakeHatchling: 'assets/cards/cat_1.jpg',
  DragonCardType.glimmeringWhelp: 'assets/cards/cat_2.jpg',
  DragonCardType.sunstoneDrake: 'assets/cards/cat_3.jpg',
};

const _cardDescriptions = {
  DragonCardType.dragonBreath:
      'If you draw this and cannot defuse it, you lose.',
  DragonCardType.defuse:
      "Survive the Dragon's Breath, then re-insert it anywhere in the deck.",
  DragonCardType.attack:
      'End your turn without drawing. Your opponent takes two turns.',
  DragonCardType.skip: 'End your turn without drawing a card.',
  DragonCardType.seeTheFuture: 'Privately view the top 3 cards of the deck.',
  DragonCardType.shuffle: 'Shuffle the draw pile thoroughly.',
  DragonCardType.emberdrakeHatchling: 'A cute but useless creature.',
  DragonCardType.glimmeringWhelp: 'A cute but useless creature.',
  DragonCardType.sunstoneDrake: 'A cute but useless creature.',
};

/// The 2-player Dragon's Breath mini-game (port of DragonsBreathScreen.tsx):
/// draw or play cards, defuse the dragon, peek the future, survive.
class DragonsBreathScreen extends StatefulWidget {
  const DragonsBreathScreen({super.key});
  @override
  State<DragonsBreathScreen> createState() => _DragonsBreathScreenState();
}

class _DragonsBreathScreenState extends State<DragonsBreathScreen> {
  bool _gameOverSoundPlayed = false;

  @override
  Widget build(BuildContext context) {
    final game = context.watch<GameProvider>();
    final state = game.gameState;
    final db = state.dragonsBreathState;
    if (db == null) {
      return const Center(
          child: CircularProgressIndicator(color: PavalonColors.gold));
    }

    final myId = game.playerId;
    final opponent =
        state.players.where((p) => p.id != myId).firstOrNull;
    final myHand = myId != null ? (db.hands[myId] ?? const []) : const <DragonCard>[];
    final oppHandCount =
        opponent != null ? (db.hands[opponent.id]?.length ?? 0) : 0;
    final myTurn = db.currentPlayerId == myId;
    final gameOver = db.winner != null;

    if (gameOver && !_gameOverSoundPlayed) {
      _gameOverSoundPlayed = true;
      context.read<AudioService>().play(Sfx.dbGameOver, duckBgm: true);
      Haptics.dramatic();
    }

    return Stack(
      children: [
        Column(
          children: [
            // Opponent strip
            Container(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  Text(opponent?.name ?? 'Opponent',
                      style: eagle(16, color: Colors.white)),
                  const SizedBox(height: 6),
                  SizedBox(
                    height: 56,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        for (var i = 0; i < oppHandCount.clamp(0, 8); i++)
                          Transform.translate(
                            offset: Offset(i * -12.0 + oppHandCount * 5, 0),
                            child: _miniCardBack(),
                          ),
                        const SizedBox(width: 12),
                        Text('$oppHandCount cards',
                            style: const TextStyle(
                                fontSize: 12,
                                color: PavalonColors.slate400)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Spacer(),
            // Table: deck + discard
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Deck (tap to draw)
                GestureDetector(
                  onTap: myTurn &&
                          !gameOver &&
                          db.isPlacingDragon == null &&
                          db.isViewingFuture == null
                      ? () {
                          Haptics.confirm();
                          context.read<AudioService>().play(Sfx.cardSwish,
                              overlay: true);
                          game.drawCard();
                        }
                      : null,
                  child: PulsingGlow(
                    color: myTurn
                        ? PavalonColors.gold
                        : Colors.transparent,
                    child: Column(
                      children: [
                        _tableCard('assets/cards/card_back.jpg'),
                        const SizedBox(height: 6),
                        Text('DECK · ${db.deck.length}',
                            style: const TextStyle(
                                fontSize: 11,
                                letterSpacing: 1.5,
                                color: PavalonColors.slate400)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 30),
                // Discard
                Column(
                  children: [
                    db.discardPile.isEmpty
                        ? Container(
                            width: 92,
                            height: 128,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                  color: PavalonColors.slate700, width: 2),
                            ),
                          )
                        : _tableCard(
                            _cardImages[db.discardPile.last.type] ??
                                'assets/cards/card_back.jpg'),
                    const SizedBox(height: 6),
                    const Text('DISCARD',
                        style: TextStyle(
                            fontSize: 11,
                            letterSpacing: 1.5,
                            color: PavalonColors.slate400)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
            // Turn banner
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
              decoration: BoxDecoration(
                color: myTurn
                    ? PavalonColors.gold.withValues(alpha: 0.15)
                    : PavalonColors.slate800,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                    color:
                        myTurn ? PavalonColors.gold : PavalonColors.slate700),
              ),
              child: Text(
                gameOver
                    ? 'Game Over'
                    : myTurn
                        ? db.turnsToTake > 1
                            ? 'Your turn — take ${db.turnsToTake} turns!'
                            : 'Your turn — tap the deck or play a card'
                        : "${opponent?.name ?? 'Opponent'}'s turn...",
                style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: myTurn
                        ? PavalonColors.goldBright
                        : PavalonColors.slate300),
              ),
            ),
            const Spacer(),
            // My hand
            SizedBox(
              height: 170,
              child: myHand.isEmpty
                  ? const Center(
                      child: Text('No cards in hand',
                          style: TextStyle(color: PavalonColors.slate500)))
                  : ListView.builder(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      itemCount: myHand.length,
                      itemBuilder: (context, i) =>
                          _handCard(context, game, myHand[i], myTurn && !gameOver),
                    ),
            ),
            const SizedBox(height: 8),
          ],
        ),
        // See-the-future overlay
        if (db.isViewingFuture == myId)
          _futureOverlay(context, game, db.futureCards),
        // Dragon placement overlay
        if (db.isPlacingDragon == myId)
          _placementOverlay(context, game, db.deck.length),
        // Win/lose overlay
        if (gameOver) _gameOverOverlay(context, game, db, myId),
      ],
    );
  }

  Widget _miniCardBack() => Container(
        width: 36,
        height: 52,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: PavalonColors.slate600),
          image: const DecorationImage(
              image: AssetImage('assets/cards/card_back.jpg'),
              fit: BoxFit.cover),
        ),
      );

  Widget _tableCard(String asset) => Container(
        width: 92,
        height: 128,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: PavalonColors.slate600, width: 2),
          boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 10)],
          image: DecorationImage(image: AssetImage(asset), fit: BoxFit.cover),
        ),
      );

  Widget _handCard(
      BuildContext context, GameProvider game, DragonCard card, bool canPlay) {
    final playable = canPlay &&
        card.type != DragonCardType.defuse &&
        card.type != DragonCardType.dragonBreath;
    return GestureDetector(
      onTap: () => _showCardSheet(context, game, card, playable),
      child: Container(
        width: 104,
        margin: const EdgeInsets.symmetric(horizontal: 5),
        child: Column(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 104,
              height: 144,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: playable
                        ? PavalonColors.gold
                        : PavalonColors.slate600,
                    width: 2),
                boxShadow: const [
                  BoxShadow(color: Colors.black54, blurRadius: 8)
                ],
                image: DecorationImage(
                    image: AssetImage(_cardImages[card.type] ??
                        'assets/cards/card_back.jpg'),
                    fit: BoxFit.cover),
              ),
            ),
            const SizedBox(height: 4),
            Text(card.type.wire,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 10.5)),
          ],
        ),
      ),
    );
  }

  void _showCardSheet(
      BuildContext context, GameProvider game, DragonCard card, bool playable) {
    showModalBottomSheet(
      context: context,
      backgroundColor: PavalonColors.slate900,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(card.type.wire, style: eagle(20)),
              const SizedBox(height: 8),
              Text(_cardDescriptions[card.type] ?? '',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: PavalonColors.slate300)),
              const SizedBox(height: 16),
              if (playable)
                PavalonButton(
                  label: 'Play ${card.type.wire}',
                  expand: true,
                  onPressed: () {
                    Navigator.of(sheetContext).pop();
                    Haptics.confirm();
                    context
                        .read<AudioService>()
                        .play(Sfx.cardSwish, overlay: true);
                    game.playCard(card.id);
                  },
                )
              else
                const Text('This card cannot be played right now.',
                    style: TextStyle(color: PavalonColors.slate500)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _futureOverlay(
      BuildContext context, GameProvider game, List<DragonCard> cards) {
    return Material(
      color: Colors.black.withValues(alpha: 0.9),
      child: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('The Future Reveals...', style: eagle(24)),
              const SizedBox(height: 6),
              const Text('Top of the deck, left to right',
                  style: TextStyle(color: PavalonColors.slate400)),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < cards.length; i++)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: Column(
                        children: [
                          Text('#${i + 1}',
                              style: const TextStyle(
                                  color: PavalonColors.goldBright,
                                  fontWeight: FontWeight.bold)),
                          const SizedBox(height: 6),
                          _tableCard(_cardImages[cards[i].type] ??
                              'assets/cards/card_back.jpg'),
                          const SizedBox(height: 6),
                          SizedBox(
                              width: 92,
                              child: Text(cards[i].type.wire,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(fontSize: 11))),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 24),
              PavalonButton(
                  label: 'Got it', onPressed: () => game.endFutureView()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _placementOverlay(
      BuildContext context, GameProvider game, int deckSize) {
    return Material(
      color: Colors.black.withValues(alpha: 0.9),
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const Icon(LucideIcons.flame,
                    size: 48, color: Color(0xFFF97316)),
                const SizedBox(height: 10),
                Text('Defused!', style: eagle(26, color: PavalonColors.success)),
                const SizedBox(height: 8),
                const Text(
                    "Slide the Dragon's Breath back into the deck.\nChoose how deep to bury it:",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: PavalonColors.slate300)),
                const SizedBox(height: 20),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  alignment: WrapAlignment.center,
                  children: [
                    for (var i = 0; i <= deckSize; i++)
                      OutlinedButton(
                        onPressed: () {
                          Haptics.confirm();
                          game.placeDragonCard(i);
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: PavalonColors.goldBright,
                          side: const BorderSide(color: PavalonColors.gold),
                        ),
                        child: Text(i == 0
                            ? 'Top'
                            : i == deckSize
                                ? 'Bottom'
                                : '$i deep'),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _gameOverOverlay(BuildContext context, GameProvider game,
      DragonsBreathState db, String? myId) {
    final iWon = db.winner == myId;
    final color = iWon ? PavalonColors.good : PavalonColors.evil;
    return Material(
      color: Colors.black.withValues(alpha: 0.92),
      child: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(iWon ? LucideIcons.trophy : LucideIcons.flame,
                  size: 64, color: color),
              const SizedBox(height: 14),
              Text(iWon ? 'VICTORY!' : 'INCINERATED!',
                  style: eagle(36, color: color)),
              const SizedBox(height: 8),
              Text(
                  iWon
                      ? 'Your opponent drew the Dragon\'s Breath.'
                      : 'The Dragon\'s Breath consumed you.',
                  style: const TextStyle(color: PavalonColors.slate300)),
              const SizedBox(height: 24),
              PavalonButton(
                  label: 'Return to Lobby',
                  onPressed: () => game.returnToLobby()),
            ],
          ),
        ),
      ),
    );
  }
}
