# Emoji Showdown

A local-network party game for one host laptop and player phones. The host opens the TV screen, players join on the same Wi-Fi, and everyone makes absurd emoji art across three prompts.

## Setup

```bash
npm install
npm run dev
```

Open the host screen on the laptop:

```text
http://localhost:3000/host
```

Players join from phones using the local network URL printed in the terminal, usually something like:

```text
http://192.168.1.25:3000
```

If the printed URL does not work, make sure the laptop and phones are on the same Wi-Fi, then find the laptop's local IP address and use `http://YOUR-IP:3000`.

## How To Play

1. Players join with a name.
2. Everyone taps `I'm ready` on their phone. The TV has no host controls.
3. The game automatically runs three prompts.
4. Each prompt gives everyone the same three required emojis plus 15 balanced random emojis per player.
5. Players create emoji art with up to 24 placed emojis. Drag emojis from the tray, move the selected emoji with one finger anywhere on the canvas, and pinch/rotate it with two fingers anywhere on the canvas.
6. After all three prompts are submitted, the TV reveals each prompt's artwork.
7. Players vote for their favorite artwork for each prompt.
8. Each prompt winner gets 1 point. The final leaderboard crowns the champion.

## Notes

- No database, accounts, auth, or external services.
- All game state is in memory and resets when the server restarts.
- Rejoining by the same name restores that player's game state while the server is still running.
- The host page is passive and TV-focused. Phones drive ready, submit, vote, and play-again actions.
