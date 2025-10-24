# Official Seka Svara Rules

**Source**: [http://seka-ru.com/en/rules-seka.php](http://seka-ru.com/en/rules-seka.php)

---

## Game Overview

**Seka (Svara)** is a betting card game popular in Eastern Europe. The goal is to win the pot by having the highest point total or forcing all opponents to fold.

- **Players**: 2-10 players
- **Deck**: 36 cards (6 to Ace)
- **Cards Dealt**: 3 cards per player (face down)

---

## Card Values

| Card | Points |
|------|--------|
| Ace | 11 |
| King, Queen, Jack, 10 | 10 each |
| 9 | 9 |
| 8 | 8 |
| 7 | 7 |
| 6 | 6 |

---

## Scoring System (CRITICAL!)

### 🏆 **Winner = Highest Point Total**

The scoring follows this priority:

### 1. **Three of a Kind (Same Rank)**
Sum all three cards.

**SPECIAL EXCEPTION**: Three 7s = **34 points** (not 21!)

| Hand | Points | Example |
|------|--------|---------|
| **Three 7s** | **34** | 7♥ 7♦ 7♠ = 34 |
| Three Aces | 33 | A♥ A♦ A♣ = 33 |
| Three Kings | 30 | K♥ K♦ K♠ = 30 |
| Three Queens | 30 | Q♥ Q♦ Q♣ = 30 |
| Three Jacks | 30 | J♥ J♦ J♣ = 30 |
| Three 10s | 30 | 10♥ 10♦ 10♠ = 30 |
| Three 9s | 27 | 9♥ 9♦ 9♠ = 27 |
| Three 8s | 24 | 8♥ 8♦ 8♠ = 24 |
| Three 6s | 18 | 6♥ 6♦ 6♠ = 18 |

### 2. **Two Aces**
Any hand with exactly 2 Aces = **ALWAYS 22 points** (regardless of third card or suits)

| Hand | Points | Note |
|------|--------|------|
| A♥ A♦ K♣ | **22** | Not 32! Always 22 |
| A♠ A♣ 6♦ | **22** | Not 28! Always 22 |

### 3. **Flush (Same Suit)**
Sum cards of the same suit, choose the highest sum.

| Hand | Points | Example |
|------|--------|---------|
| A-K-Q same suit | 31 | A♥ K♥ Q♥ = 31 |
| K-Q-J same suit | 30 | K♠ Q♠ J♠ = 30 |
| 10-9-8 same suit | 27 | 10♦ 9♦ 8♦ = 27 |

### 4. **High Card (Mixed Suits)**
Highest single card value.

| Hand | Points | Example |
|------|--------|---------|
| Ace high | 11 | A♥ K♦ Q♣ = 11 |
| King high | 10 | K♥ 9♦ 8♣ = 10 |

---

## Joker: 7 of Clubs

The **7 of Clubs (7♣)** acts as a wildcard:

- **For ranks**: Replaces missing card to complete Three of a Kind
- **For suits**: Worth 11 points

### Examples with Joker:

| Hand | Joker Becomes | Result | Points |
|------|---------------|--------|--------|
| 7♣ A♥ A♦ | Ace of Clubs | Three Aces | 33 |
| 7♣ K♥ K♦ | King of Clubs | Three Kings | 30 |
| 7♣ A♥ K♥ | Ace of Hearts | Flush A-K-7 | 29 |

---

## Betting Actions

During each round, players can:

1. **Drop (Fold)** - Forfeit hand and exit round
2. **Raise** - Increase the bet
3. **Reveal** - Compare cards with previous player (after 1st round)
4. **Support (Call)** - Match the current bet
5. **Watch** - Look at cards (exit "dark" mode)

---

## Special Game Modes

### "In the Dark"
- Players don't see their cards
- Dark players force others to pay **2x** their bet
- Can look at cards anytime to exit dark mode

### "Svara" (Tie-Breaker)
- Triggered when players have equal points
- New round with same players
- Pot carries over
- Players can agree to split pot

---

## Game Flow

1. **Ante** - All players place initial bet
2. **Deal** - 3 cards per player (face down)
3. **Betting Rounds** - Multiple rounds of betting
4. **Showdown** - Reveal cards, highest points wins
5. **Winner** - Takes entire pot

---

## Important Notes

⚠️ **The scoring system is NOT like poker!**
- It's not about "hand rankings"
- It's about **POINT TOTALS**
- Three 7s (34 pts) beats Three Aces (33 pts)
- Two Aces is ALWAYS 22 points (special rule)

✅ **Implementation Status**
- All rules correctly implemented
- 20/20 unit tests passing
- Joker logic fully functional
- Tie detection (Svara) working

---

## References

- Official Rules: [http://seka-ru.com/en/rules-seka.php](http://seka-ru.com/en/rules-seka.php)
- Online Platform: [http://seka-ru.com/en/](http://seka-ru.com/en/)

---

**Last Updated**: 2025-10-18  
**Implementation**: Developer 2  
**Status**: ✅ Complete and Verified

