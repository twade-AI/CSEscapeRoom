/* ==========================================================================
   data.js  —  All puzzle content, answers and room keys for the Escape Room.
   Pure data, no logic. Loaded as a global `ROOMS` (and `GAME` meta).
   Edit the answers/keys here if you want to change the puzzles.
   ========================================================================== */

const GAME = {
  title: "Escape the Room",
  subtitle: "Computer Science",
  // The final escape instruction (revealed once the last room is solved).
  // This is the decoded message from the Grey Room shift cipher.
  escapeMessage:
    "To win and escape, you must place a Rubik's Cube on your desk with at " +
    "least five of your team's colours facing up.",

  // Narrative wrapper shown at the start and the end. Edit freely.
  story: {
    intro:
      "It's late, the lab door has locked behind you, and the school's server " +
      "has been hijacked by a rogue program. Nine rooms stand between your team " +
      "and the exit. Crack the Computer Science puzzle in each room to earn the " +
      "key to the next. Work fast — and good luck.",
    outro:
      "The server powers down, the locks click open, and daylight floods in. " +
      "Your team cracked every room. You're free!"
  },

  // Printable certificate wording (team name + time are filled in automatically).
  certificate: {
    title: "Certificate of Escape",
    line: "has successfully escaped the Computer Science Escape Room"
  },

  // Default teacher settings (can be changed in-app on the ⚙ Settings panel).
  settingsDefaults: {
    timerMode: "countup",   // "off" | "countup" | "countdown"
    timerMinutes: 45,       // used when timerMode === "countdown"
    difficulty: "normal",   // "easy" | "normal" | "hard"  (controls hint budget)
    sound: true,
    ambient: false,
    shuffle: true,          // randomise puzzle layouts each game (anti-copying)
    teamName: "",
    rooms: null,            // null = all rooms; otherwise an array of room ids
    reducedMotion: false,
    dyslexia: false,
    highContrast: false,
    colourblind: false,
    textScale: 1
  },

  // Hint budget per difficulty: count = hints allowed (Infinity = unlimited),
  // penalty = seconds added to the timer for each hint used.
  hintPolicy: {
    easy:   { count: Infinity, penalty: 0 },
    normal: { count: 6,        penalty: 30 },
    hard:   { count: 3,        penalty: 60 }
  }
};

/* Each room object:
   id        – short slug, used in URLs / storage
   name      – room name
   place     – the "location" sub-title from the original pack
   colour    – theme colour (hex) used for the door + accents
   icon      – emoji shown on the door
   type      – which puzzle engine renders it
   blurb     – the instruction line shown to pupils
   key       – the KEY pupils earn for solving this room (opens the NEXT door
               in their randomised route)
   bonus     – optional bonus riddle {q, a}
   ...type-specific fields
*/
const ROOMS = [

  /* ----------------------------------------------------------------- 1 */
  {
    id: "garage",
    name: "Yellow Room",
    place: "The Garage",
    colour: "#f4c430",
    icon: "🔧",
    type: "anagram",
    blurb: "Unscramble each wheel to reveal a networking keyword. Two of the " +
           "six wheels are SPARE WHEELS — they are not real anagrams. Solve " +
           "the four real ones and flag the two spares.",
    key: "NETWORK",
    bonus: {
      q: "A type of malware that keeps replicating itself and spreads between " +
         "computers across the internet is known as a … ?",
      a: "WORM"
    },
    // wheels: scrambled letters. answer = "" means it is a SPARE (no anagram).
    wheels: [
      { label: "1", scrambled: "TOURER",    answer: "ROUTER" },
      { label: "2", scrambled: "DITNBADWH", answer: "BANDWIDTH" },
      { label: "3", scrambled: "ETYNOUTE",  answer: "" },        // SPARE
      { label: "4", scrambled: "OETOLBUTH", answer: "BLUETOOTH" },
      { label: "5", scrambled: "OOOTPRCL",  answer: "PROTOCOL" },
      { label: "6", scrambled: "EERPOZK",   answer: "" }         // SPARE
    ]
  },

  /* ----------------------------------------------------------------- 2 */
  {
    id: "nowhere",
    name: "Blue Room",
    place: "Nowhere",
    colour: "#3aa0ff",
    icon: "🧩",
    type: "eliminate",
    blurb: "In every row, cross out letters until only ONE remains in each " +
           "group. The surviving letters spell a cyber-security keyword.",
    key: "FIREWALL",
    bonus: {
      q: "To copy the contents of a document in MS Word, which keyboard " +
         "command do you use?",
      a: "CTRL + C"
    },
    // each row: list of groups (each group is a string of letters); answer is
    // the word formed by keeping exactly one correct letter from each group.
    rows: [
      { groups: ["SPH","QHO","IUM","EIS","HWR","RIO","RNE","GKL"], answer: "PHISHING" },
      { groups: ["JFM","ORA","LUE","WER","DNA","EOR","MEY"],       answer: "MALWARE" },
      { groups: ["PZS","OEQ","CBT","AXU","ROT","IWO","TYE","YAS"], answer: "SECURITY" },
      { groups: ["CS","KY","AB","ET","ER","CB","OR","IA","RM","ED"], answer: "CYBERCRIME" },
      { groups: ["PB","LR","AI","NV","KA","CE","YT"],              answer: "PRIVACY" },
      { groups: ["HT","ER","LO","MJ","AE","NT"],                   answer: "TROJAN" }
    ]
  },

  /* ----------------------------------------------------------------- 3 */
  {
    id: "corridor1",
    name: "Orange Room",
    place: "Corridor 1",
    colour: "#ff8c2b",
    icon: "🧠",
    type: "crossword",
    blurb: "Complete the crossword about the CPU, registers and memory. " +
           "Type a letter in each square; correct words lock in green.",
    key: "FETCH",
    bonus: null,
    // Crossword grid, generated & verified so every crossing is consistent.
    crossword: {
      "height": 10,
      "width": 12,
      "solution": [
        ["","","V","O","L","A","T","I","L","E","",""],
        ["","","","","","","","","","M","A","R"],
        ["","","","","","","R","","","B","","O"],
        ["","","","","","C","A","C","H","E","","M"],
        ["","","","","","","M","","","D","",""],
        ["","","","","","","","","M","D","R",""],
        ["","","","","","","","","","E","",""],
        ["C","L","O","C","K","S","P","E","E","D","",""],
        ["","","","P","","","","","","","",""],
        ["A","C","C","U","M","U","L","A","T","O","R",""]
      ],
      "numbers": [
        [0,0,1,0,0,0,0,0,0,2,0,0],
        [0,0,0,0,0,0,0,0,0,3,0,4],
        [0,0,0,0,0,0,5,0,0,0,0,0],
        [0,0,0,0,0,6,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,7,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0],
        [8,0,0,9,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0],
        [10,0,0,0,0,0,0,0,0,0,0,0]
      ],
      "entries": [
        { "num":1,  "row":0, "col":2,  "dir":"A", "answer":"VOLATILE",    "clue":"Data stored in v_______ memory is lost when the computer is turned off." },
        { "num":3,  "row":1, "col":9,  "dir":"A", "answer":"MAR",         "clue":"A register holding the address of the instruction currently being read/written (Memory Address Register)." },
        { "num":6,  "row":3, "col":5,  "dir":"A", "answer":"CACHE",       "clue":"High-speed memory built into the CPU; instructions are copied here to be accessed more quickly." },
        { "num":7,  "row":5, "col":8,  "dir":"A", "answer":"MDR",         "clue":"A register containing the instruction/data just copied from main memory (Memory Data Register)." },
        { "num":8,  "row":7, "col":0,  "dir":"A", "answer":"CLOCKSPEED",  "clue":"How many instruction cycles the CPU can deal with per second (MHz/GHz). Faster is better." },
        { "num":10, "row":9, "col":0,  "dir":"A", "answer":"ACCUMULATOR", "clue":"A register that stores the result of the last operation in the ALU." },
        { "num":2,  "row":0, "col":9,  "dir":"D", "answer":"EMBEDDED",    "clue":"Specialist hardware/software built into a device for one purpose, e.g. a washing machine (____ system)." },
        { "num":4,  "row":1, "col":11, "dir":"D", "answer":"ROM",         "clue":"Read Only Memory; can be read but not changed, and is not lost when the computer is off." },
        { "num":5,  "row":2, "col":6,  "dir":"D", "answer":"RAM",         "clue":"Random Access Memory; read/write memory whose contents are lost when the computer is off." },
        { "num":9,  "row":7, "col":3,  "dir":"D", "answer":"CPU",         "clue":"The chip that controls all parts of the computer and decodes then executes program instructions." }
      ]
    }
  },

  /* ----------------------------------------------------------------- 4 */
  {
    id: "corridor2",
    name: "Teal Room",
    place: "Corridor 2",
    colour: "#1fb6b6",
    icon: "🖥️",
    type: "spoterror",
    blurb: "Spot which computers are running BUGGY code. Click a monitor to " +
           "mark it with a ✗. Leave the working program alone.",
    key: "DEBUG",
    bonus: null,
    // Each monitor: code lines, hasError, and an explanation revealed at the end.
    monitors: [
      { code: 'print("hello world)\na = 5\nif a == 5:\n    print("number = 5")',
        hasError: true,
        why: "Line 1 is missing the closing quotation mark: print(\"hello world\")." },
      { code: 'a = int(input(""))\nif a == 7\n    print("correct")',
        hasError: true,
        why: "The if statement is missing its colon: if a == 7:" },
      { code: 'A = 5\nB = 10\nC = A + b\nprint(c)',
        hasError: true,
        why: "Python is case-sensitive. 'b' and 'c' are undefined — it should be A + B and print(C)." },
      { code: 'num = 0\nwhile num < 5:\n    num = num ! num',
        hasError: true,
        why: "'!' is not a valid operator. It should be something like num = num + 1." },
      { code: 'name = input()\nPrint(Name)',
        hasError: true,
        why: "'Print' should be lowercase 'print', and 'Name' is undefined — use 'name'." },
      { code: 'for i in range(5):\n    print(i)',
        hasError: false,
        why: "This program is perfectly correct — it prints 0 to 4." }
    ]
  },

  /* ----------------------------------------------------------------- 5 */
  {
    id: "attic",
    name: "Red Room",
    place: "The Attic",
    colour: "#ff5470",
    icon: "📂",
    type: "match",
    blurb: "Drag each key term onto the definition it matches. THREE terms " +
           "are spare and belong to no definition — leave them behind.",
    key: "KERNEL",
    bonus: {
      q: "Who designed the PHP programming language?",
      a: "RASMUS LERDORF"
    },
    // definitions in order; terms list contains correct ones + 3 spares.
    definitions: [
      { text: "A part of the operating system that lets the user interact with and control it, usually with a graphical component shown on a display.", answer: "User Interface" },
      { text: "Software which compresses data so that it takes up less storage space.", answer: "Data Compression" },
      { text: "An OS function that manages the access different users and applications have to the system, granting access to different parts.", answer: "Access Rights" },
      { text: "Software which reorders files stored on a hard disk so they run in a sensible order to improve performance and efficiency.", answer: "Defragmentation" },
      { text: "An OS function that manages user accounts, each with its own username, password and access rights.", answer: "User Management" },
      { text: "The OS function that manages the computer's memory, controlling how memory is used and which applications can access it.", answer: "Memory Management" }
    ],
    terms: [
      "User Interface", "Memory Management", "Peripheral Management",
      "User Management", "File Management", "Encryption Software",
      "Defragmentation", "Data Compression", "Access Rights"
    ],
    spares: ["Peripheral Management", "File Management", "Encryption Software"]
  },

  /* ----------------------------------------------------------------- 6 */
  {
    id: "dungeon",
    name: "Purple Room",
    place: "The Dungeon",
    colour: "#a065ff",
    icon: "🔢",
    type: "sudoku",
    blurb: "Fill the 9×9 grid so every row, column and 3×3 box contains 1–9. " +
           "The six lettered cells A–F then reveal the six-digit escape code.",
    key: "158399",
    bonus: {
      q: "Who created Twitter?",
      a: "JACK DORSEY"
    },
    sudoku: {
      // 0 = empty. Givens are locked.
      puzzle: [
        [7,1,0,0,0,9,3,0,8],
        [8,0,0,6,0,0,1,0,0],
        [9,2,6,0,0,1,0,0,4],
        [0,5,0,4,6,0,2,0,0],
        [2,4,8,0,0,0,6,1,5],
        [0,0,9,0,1,2,0,8,0],
        [6,0,0,9,0,0,8,4,3],
        [0,8,0,0,0,7,0,0,6],
        [4,0,2,8,0,0,0,5,1]
      ],
      solution: [
        [7,1,4,2,5,9,3,6,8],
        [8,3,5,6,7,4,1,9,2],
        [9,2,6,3,8,1,5,7,4],
        [1,5,7,4,6,8,2,3,9],
        [2,4,8,7,9,3,6,1,5],
        [3,6,9,5,1,2,4,8,7],
        [6,7,1,9,2,5,8,4,3],
        [5,8,3,1,4,7,9,2,6],
        [4,9,2,8,3,6,7,5,1]
      ],
      // lettered cells [row, col] (0-indexed) → contribute to the 6-digit code.
      labels: { A:[3,0], B:[1,2], C:[2,4], D:[8,4], E:[7,6], F:[3,8] },
      order: ["A","B","C","D","E","F"]   // -> 1 5 8 3 9 9
    }
  },

  /* ----------------------------------------------------------------- 7 */
  {
    id: "entrance",
    name: "Green Room",
    place: "The Entrance",
    colour: "#36c46a",
    icon: "📟",
    type: "decode",
    blurb: "Crack the code-breaker. Each number is an ASCII code: 65=A, 66=B … " +
           "90=Z and 32 = space. UNDERLINED codes are in HEX. Type each answer.",
    key: "DECRYPT",
    bonus: {
      q: "Who is known as the father of video games?",
      a: "RALPH BAER"
    },
    codes: [
      { raw: "83 79 67 73 65 76 32 69 78 71 73 78 69 69 82 73 78 71", hex: false, answer: "SOCIAL ENGINEERING" },
      { raw: "4B 45 59 4C 4F 47 47 45 52",                            hex: true,  answer: "KEYLOGGER" },
      { raw: "86 85 76 78 69 82 65 66 73 76 73 84 89",                hex: false, answer: "VULNERABILITY" },
      { raw: "73 68 69 78 84 73 84 89 32 84 72 69 70 84",             hex: false, answer: "IDENTITY THEFT" },
      { raw: "50 52 4F 54 4F 43 4F 4C",                               hex: true,  answer: "PROTOCOL" },
      { raw: "44 45 4E 49 41 4C 20 4F 46 20 53 45 52 56 49 43 45",    hex: true,  answer: "DENIAL OF SERVICE" }
    ]
  },

  /* ----------------------------------------------------------------- 8 */
  {
    id: "restroom",
    name: "White Room",
    place: "The Restroom",
    colour: "#dfe6f0",
    icon: "🧷",
    type: "jigsaw",
    blurb: "Each Computer Science term has been split in two. Drag the second " +
           "half onto the matching first half. THREE halves are spare pieces — " +
           "hand those to your teacher.",
    key: "PIRACY",
    bonus: {
      q: "What is the term for copying a computer program without the " +
         "permission of its writer?",
      a: "SOFTWARE PIRACY"
    },
    // pairs to build; the right-hand halves get shuffled with the spares.
    pairs: [
      { left: "CRYPTO", right: "GRAPHY" },
      { left: "CONTROL", right: "PANEL" },
      { left: "NET", right: "WORK" },
      { left: "DISK", right: "STORAGE" },
      { left: "SOFT", right: "WARE" },
      { left: "PLAIN", right: "TEXT" },
      { left: "ALGO", right: "RITHM" },
      { left: "BIN", right: "ARY" }
    ],
    spares: ["SPACE", "BOARD", "PLUG"]   // extra right-hand halves (decoys)
  },

  /* ----------------------------------------------------------------- 9 */
  {
    id: "garden",
    name: "Grey Room",
    place: "The Garden",
    colour: "#9aa6b2",
    icon: "🗝️",
    type: "cipher",
    blurb: "The final message was scrambled with a SHIFT (Caesar) cipher. Turn " +
           "the dial to slide the alphabet until the message reads clearly — " +
           "then you'll know how to escape!",
    key: "CIPHER",   // earned like any room; the game is won once ALL rooms are solved
    bonus: {
      q: "Which of these is NOT a valid functional domain name: .net  .org  .gov  .god ?",
      a: ".GOD"
    },
    cipher: {
      text: "Dy gsx kxn ocmkzo, iye wecd zvkmo k Belsu'c Melo yx iyeb nocu " +
            "gsdr kd vokcd psfo yp iyeb dokw'c myvyebc pkmsxq ez.",
      shift: 10   // decrypt shift (move each letter back by 10)
    }
  }
];
