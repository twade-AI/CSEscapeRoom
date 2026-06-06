# 👩‍🏫 Teacher Answer Key

Full solutions for every room. Pupils unlock each door with the **key** earned in
the previous room. Turn on **Teacher mode** (corridor screen) to get a *Reveal*
button inside any room during a live demo.

> **Randomised route:** the starting room and the order are shuffled per device,
> so each group's path differs. The keys below are what **each room awards**; the
> room that key opens depends on that device's route. The game is won once **all
> nine rooms** are solved (the Grey Room cipher reveals the final challenge).

> **"Shuffle puzzle layouts" (⚙ Settings, on by default):** the *answers below are
> always correct*, but the **presentation varies per device** to stop copying —
> anagram letters are re-jumbled, the elimination distractors change, the spot-the-error
> monitors are re-ordered, ASCII codes flip between denary/hex, and the cipher uses a
> random shift (the decoded message is still the same). The **sudoku code stays
> `158399`**. Turn it off for an identical experience on every device. Use a room's
> **👁 Reveal** (Teacher mode) to see a specific device's live answer, or **🖨 Print
> answer key** from the corridor.

> **Settings & tools:** ⚙ (top-right) sets the timer, difficulty (hint budget),
> sound, team name and which rooms are included. **Teacher mode** adds *Reveal*,
> *Skip* and *Print answer key*. The win screen offers a printable **certificate**.

> Tip: keys are **not** case-sensitive and spaces are ignored, so `158399` and
> `Network` both work fine at the locks.

---

## 1. 🟡 Yellow Room — The Garage  (Anagrams)
Unscramble four networking words; **flag the two spare wheels** (they are not
anagrams of anything).

| Wheel | Letters | Answer |
|------|----------|--------|
| 1 | TOURER | **ROUTER** |
| 2 | DITNBADWH | **BANDWIDTH** |
| 3 | ETYNOUTE | **SPARE WHEEL** 🛞 |
| 4 | OETOLBUTH | **BLUETOOTH** |
| 5 | OOOTPRCL | **PROTOCOL** |
| 6 | EERPOZK | **SPARE WHEEL** 🛞 |

**Bonus riddle:** self-replicating malware that spreads over the internet → **WORM**
**Key earned → `NETWORK`**

## 2. 🔵 Blue Room — Nowhere  (Cross out letters)
Leave one letter in each group:

1. **PHISHING** 2. **MALWARE** 3. **SECURITY**
4. **CYBERCRIME** 5. **PRIVACY** 6. **TROJAN**

**Bonus riddle:** copy in MS Word → **CTRL + C**
**Key earned → `FIREWALL`**

## 3. 🟠 Orange Room — Corridor 1  (Crossword)
**Across:** 1 VOLATILE · 3 MAR · 6 CACHE · 7 MDR · 8 CLOCKSPEED · 10 ACCUMULATOR
**Down:** 2 EMBEDDED · 4 ROM · 5 RAM · 9 CPU

*(The grid is auto-generated and verified, so the clue numbers differ from the
printed pack but the answers are the same CPU/registers/memory terms.)*

**Key earned → `FETCH`**

## 4. 🟢 Teal Room — Corridor 2  (Spot the error)
Mark a monitor with ✗ if its code is **buggy**. Five are broken; one works.

| Monitor | Verdict | Bug |
|--------|---------|-----|
| 1 `print("hello world)` | ✗ buggy | missing closing quote |
| 2 `if a == 7` | ✗ buggy | missing colon |
| 3 `C = A + b` … `print(c)` | ✗ buggy | wrong case — `b`/`c` undefined |
| 4 `num = num ! num` | ✗ buggy | `!` is not an operator |
| 5 `Print(Name)` | ✗ buggy | capital `Print` and undefined `Name` |
| 6 `for i in range(5): print(i)` | ✅ correct | no error — leave it |

**Key earned → `DEBUG`**

## 5. 🔴 Red Room — The Attic  (Match terms ↔ definitions)
Drag the right term onto each definition; **three terms are spare**.

| Definition | Term |
|-----------|------|
| Lets the user interact with the system, usually graphical | **User Interface** |
| Compresses data to use less storage | **Data Compression** |
| Manages access different users/apps have to the system | **Access Rights** |
| Reorders files on disk to improve performance | **Defragmentation** |
| Manages user accounts (usernames, passwords, rights) | **User Management** |
| Controls how the computer's memory is used | **Memory Management** |

**Spare terms (leave in tray):** Peripheral Management · File Management · Encryption Software
**Bonus riddle:** who designed PHP → **RASMUS LERDORF**
**Key earned → `KERNEL`**

## 6. 🟣 Purple Room — The Dungeon  (Sudoku)
Solve the grid; read the six lettered cells.

`A=1  B=5  C=8  D=3  E=9  F=9`  →  **six-digit code `158399`**

**Bonus riddle:** who created Twitter → **JACK DORSEY**
**Key earned → `158399`**

## 7. 🟩 Green Room — The Entrance  (ASCII / Hex decoder)
`65=A … 90=Z`, `32=space`. **Underlined codes are HEX.**

1. **SOCIAL ENGINEERING** 2. **KEYLOGGER** 3. **VULNERABILITY**
4. **IDENTITY THEFT** 5. **PROTOCOL** 6. **DENIAL OF SERVICE**

**Bonus riddle:** father of video games → **RALPH BAER**
**Key earned → `DECRYPT`**

## 8. ⬜ White Room — The Restroom  (Jigsaw — rebuild words)
Join each first half to its second half; **three pieces are spare**.

CRYPTO·GRAPHY · CONTROL·PANEL · NET·WORK · DISK·STORAGE ·
SOFT·WARE · PLAIN·TEXT · ALGO·RITHM · BIN·ARY
**Spare pieces (give to teacher):** SPACE · BOARD · PLUG

*(The original pack's picture-jigsaw has been reimagined as a word-building task
so it works on screen.)*

**Bonus riddle:** copying a program without permission → **SOFTWARE PIRACY**
**Key earned → `PIRACY`**

## 9. ⬛ Grey Room — The Garden  (Shift / Caesar cipher)
Slide the dial to **shift 10** (each letter moves back 10; K→A). The message
decodes to the **escape instruction**:

> **“To win and escape, you must place a Rubik's Cube on your desk with at least
> five of your team's colours facing up.”**

**Bonus riddle:** not a valid domain → **.GOD**
**Key earned → `CIPHER`** (awarded like any room; the game is won once every room is solved)

🏆 **That's the escape!** Set this physical challenge up in your classroom, or
edit `GAME.escapeMessage` (and the cipher text) in `js/data.js` to use your own.
