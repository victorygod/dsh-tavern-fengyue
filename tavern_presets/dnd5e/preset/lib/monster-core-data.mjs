// monster-core-data.mjs — 334 statblock 核心面(2026-09-29b 由 scripts/extract-monster-core.mjs 从语料抽取;
// assemble 重跑后重抽)。spawn 运行时零 lorebook 读取——数据断档时 monster-build 回退 md 现场解析(行为同源)。
// 展开写(键序显式排稳)——行可 diff、可审;勿手改,重抽覆盖。
export const MONSTER_CORE = {
 "aboleth": {
  "cr": 10,
  "ac": 17,
  "hp": 135,
  "hp_roll": "18d10+36",
  "str": 21,
  "dex": 9,
  "con": 15,
  "int": 18,
  "wis": 15,
  "cha": 18,
  "speed": 10,
  "darkvision": 120,
  "save_prof": [
   "con",
   "int",
   "wis"
  ],
  "skill_prof": [
   "history",
   "perception"
  ],
  "languages": [
   "Deep Speech",
   "telepathy 120 ft."
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large aberration, CR 10 (5900 XP)",
  "features": [
   "Amphibious|The aboleth can breathe air and water.",
   "Mucous Cloud|While underwater, the aboleth is surrounded by transformative mucus. A creature that touches the aboleth or that hits it with a melee attack while within 5 ft. of it must make a DC 14 Constitution saving throw. On a failure, the creature is diseased for 1d4 hours. The diseased creature can breathe only underwater.",
   "Probing Telepathy|If a creature communicates telepathically with the aboleth, the aboleth learns the creature's greatest desires if the aboleth can see the creature."
  ]
 },
 "acolyte": {
  "cr": 0.25,
  "ac": 10,
  "hp": 9,
  "hp_roll": "2d8",
  "str": 10,
  "dex": 10,
  "con": 10,
  "int": 10,
  "wis": 14,
  "cha": 11,
  "speed": 30,
  "skill_prof": [
   "medicine",
   "religion"
  ],
  "languages": [
   "any one language (usually Common)"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.25 (50 XP)",
  "features": [
   "Spellcasting|The acolyte is a 1st-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 12, +4 to hit with spell attacks). The acolyte has following cleric spells prepared:"
  ]
 },
 "adult-black-dragon": {
  "cr": 14,
  "ac": 19,
  "hp": 195,
  "hp_roll": "17d12+85",
  "str": 23,
  "dex": 14,
  "con": 21,
  "int": 14,
  "wis": 13,
  "cha": 17,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "acid"
  ],
  "vuln": [],
  "description": "Huge dragon, CR 14 (11500 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water.",
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "adult-blue-dragon": {
  "cr": 16,
  "ac": 19,
  "hp": 225,
  "hp_roll": "18d12+108",
  "str": 25,
  "dex": 10,
  "con": 23,
  "int": 16,
  "wis": 15,
  "cha": 19,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "lightning"
  ],
  "vuln": [],
  "description": "Huge dragon, CR 16 (15000 XP)",
  "features": [
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "adult-brass-dragon": {
  "cr": 13,
  "ac": 18,
  "hp": 172,
  "hp_roll": "15d12+75",
  "str": 23,
  "dex": 10,
  "con": 21,
  "int": 14,
  "wis": 13,
  "cha": 17,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "history",
   "perception",
   "persuasion",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Huge dragon, CR 13 (10000 XP)",
  "features": [
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "adult-bronze-dragon": {
  "cr": 15,
  "ac": 19,
  "hp": 212,
  "hp_roll": "17d12+102",
  "str": 25,
  "dex": 10,
  "con": 23,
  "int": 16,
  "wis": 15,
  "cha": 19,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "insight",
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "lightning"
  ],
  "vuln": [],
  "description": "Huge dragon, CR 15 (13000 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water.",
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "adult-copper-dragon": {
  "cr": 14,
  "ac": 18,
  "hp": 184,
  "hp_roll": "16d12+80",
  "str": 23,
  "dex": 12,
  "con": 21,
  "int": 18,
  "wis": 15,
  "cha": 17,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "deception",
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "acid"
  ],
  "vuln": [],
  "description": "Huge dragon, CR 14 (11500 XP)",
  "features": [
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "adult-gold-dragon": {
  "cr": 17,
  "ac": 19,
  "hp": 256,
  "hp_roll": "19d12+133",
  "str": 27,
  "dex": 14,
  "con": 25,
  "int": 16,
  "wis": 15,
  "cha": 24,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "insight",
   "perception",
   "persuasion",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Huge dragon, CR 17 (18000 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water.",
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "adult-green-dragon": {
  "cr": 15,
  "ac": 19,
  "hp": 207,
  "hp_roll": "18d12+90",
  "str": 23,
  "dex": 12,
  "con": 21,
  "int": 18,
  "wis": 15,
  "cha": 17,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "deception",
   "insight",
   "perception",
   "persuasion",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Huge dragon, CR 15 (13000 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water.",
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "adult-red-dragon": {
  "cr": 17,
  "ac": 19,
  "hp": 256,
  "hp_roll": "19d12+133",
  "str": 27,
  "dex": 10,
  "con": 25,
  "int": 16,
  "wis": 13,
  "cha": 21,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Huge dragon, CR 17 (18000 XP)",
  "features": [
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "adult-silver-dragon": {
  "cr": 16,
  "ac": 19,
  "hp": 243,
  "hp_roll": "18d12+126",
  "str": 27,
  "dex": 10,
  "con": 25,
  "int": 16,
  "wis": 13,
  "cha": 21,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "arcana",
   "history",
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "cold"
  ],
  "vuln": [],
  "description": "Huge dragon, CR 16 (15000 XP)",
  "features": [
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "adult-white-dragon": {
  "cr": 13,
  "ac": 18,
  "hp": 200,
  "hp_roll": "16d12+96",
  "str": 22,
  "dex": 10,
  "con": 22,
  "int": 8,
  "wis": 12,
  "cha": 12,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "cold"
  ],
  "vuln": [],
  "description": "Huge dragon, CR 13 (10000 XP)",
  "features": [
   "Ice Walk|The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, difficult terrain composed of ice or snow doesn't cost it extra movement.",
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "air-elemental": {
  "cr": 5,
  "ac": 15,
  "hp": 90,
  "hp_roll": "12d10+24",
  "str": 14,
  "dex": 20,
  "con": 14,
  "int": 6,
  "wis": 10,
  "cha": 6,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "Auran"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "lightning",
   "thunder"
  ],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Large elemental, CR 5 (1800 XP)",
  "features": [
   "Air Form|The elemental can enter a hostile creature's space and stop there. It can move through a space as narrow as 1 inch wide without squeezing."
  ]
 },
 "ancient-black-dragon": {
  "cr": 21,
  "ac": 22,
  "hp": 367,
  "hp_roll": "21d20+147",
  "str": 27,
  "dex": 14,
  "con": 25,
  "int": 16,
  "wis": 15,
  "cha": 19,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "acid"
  ],
  "vuln": [],
  "description": "Gargantuan dragon, CR 21 (33000 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water.",
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "ancient-blue-dragon": {
  "cr": 23,
  "ac": 22,
  "hp": 481,
  "hp_roll": "26d20+208",
  "str": 29,
  "dex": 10,
  "con": 27,
  "int": 18,
  "wis": 17,
  "cha": 21,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "lightning"
  ],
  "vuln": [],
  "description": "Gargantuan dragon, CR 23 (50000 XP)",
  "features": [
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "ancient-brass-dragon": {
  "cr": 20,
  "ac": 20,
  "hp": 297,
  "hp_roll": "17d20+119",
  "str": 27,
  "dex": 10,
  "con": 25,
  "int": 16,
  "wis": 15,
  "cha": 19,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "history",
   "perception",
   "persuasion",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Gargantuan dragon, CR 20 (25000 XP)",
  "features": [
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "ancient-bronze-dragon": {
  "cr": 22,
  "ac": 22,
  "hp": 444,
  "hp_roll": "24d20+192",
  "str": 29,
  "dex": 10,
  "con": 27,
  "int": 18,
  "wis": 17,
  "cha": 21,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "insight",
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "lightning"
  ],
  "vuln": [],
  "description": "Gargantuan dragon, CR 22 (41000 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water.",
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "ancient-copper-dragon": {
  "cr": 21,
  "ac": 21,
  "hp": 350,
  "hp_roll": "20d20+140",
  "str": 27,
  "dex": 12,
  "con": 25,
  "int": 20,
  "wis": 17,
  "cha": 19,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "deception",
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "acid"
  ],
  "vuln": [],
  "description": "Gargantuan dragon, CR 21 (33000 XP)",
  "features": [
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "ancient-gold-dragon": {
  "cr": 24,
  "ac": 22,
  "hp": 546,
  "hp_roll": "28d20+252",
  "str": 30,
  "dex": 14,
  "con": 29,
  "int": 18,
  "wis": 17,
  "cha": 28,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "insight",
   "perception",
   "persuasion",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Gargantuan dragon, CR 24 (62000 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water.",
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "ancient-green-dragon": {
  "cr": 22,
  "ac": 21,
  "hp": 385,
  "hp_roll": "22d20+154",
  "str": 27,
  "dex": 12,
  "con": 25,
  "int": 20,
  "wis": 17,
  "cha": 19,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "deception",
   "insight",
   "perception",
   "persuasion",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Gargantuan dragon, CR 22 (41000 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water.",
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "ancient-red-dragon": {
  "cr": 24,
  "ac": 22,
  "hp": 546,
  "hp_roll": "28d20+252",
  "str": 30,
  "dex": 10,
  "con": 29,
  "int": 18,
  "wis": 15,
  "cha": 23,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Gargantuan dragon, CR 24 (62000 XP)",
  "features": [
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "ancient-silver-dragon": {
  "cr": 23,
  "ac": 22,
  "hp": 487,
  "hp_roll": "25d20+225",
  "str": 30,
  "dex": 10,
  "con": 29,
  "int": 18,
  "wis": 15,
  "cha": 23,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "arcana",
   "history",
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "cold"
  ],
  "vuln": [],
  "description": "Gargantuan dragon, CR 23 (50000 XP)",
  "features": [
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "ancient-white-dragon": {
  "cr": 20,
  "ac": 20,
  "hp": 333,
  "hp_roll": "18d20+144",
  "str": 26,
  "dex": 10,
  "con": 26,
  "int": 10,
  "wis": 13,
  "cha": 14,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "cold"
  ],
  "vuln": [],
  "description": "Gargantuan dragon, CR 20 (25000 XP)",
  "features": [
   "Ice Walk|The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, difficult terrain composed of ice or snow doesn't cost it extra movement.",
   "Legendary Resistance|If the dragon fails a saving throw, it can choose to succeed instead."
  ]
 },
 "androsphinx": {
  "cr": 17,
  "ac": 17,
  "hp": 199,
  "hp_roll": "19d10+95",
  "str": 22,
  "dex": 10,
  "con": 20,
  "int": 16,
  "wis": 18,
  "cha": 23,
  "speed": 40,
  "save_prof": [
   "dex",
   "con",
   "int",
   "wis"
  ],
  "skill_prof": [
   "arcana",
   "perception",
   "religion"
  ],
  "languages": [
   "Common",
   "Sphinx"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing",
   "psychic"
  ],
  "vuln": [],
  "description": "Large monstrosity, CR 17 (18000 XP)",
  "features": [
   "Inscrutable|The sphinx is immune to any effect that would sense its emotions or read its thoughts, as well as any divination spell that it refuses. Wisdom (Insight) checks made to ascertain the sphinx's intentions or sincerity have disadvantage.",
   "Magic Weapons|The sphinx's weapon attacks are magical.",
   "Spellcasting|The sphinx is a 12th-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 18, +10 to hit with spell attacks). It requires no material components to cast its spells. The sphinx has the following cleric spells prepared:"
  ]
 },
 "animated-armor": {
  "cr": 1,
  "ac": 18,
  "hp": 33,
  "hp_roll": "6d8+6",
  "str": 14,
  "dex": 11,
  "con": 13,
  "int": 1,
  "wis": 3,
  "cha": 1,
  "speed": 25,
  "resist": [],
  "immune": [
   "poison",
   "psychic"
  ],
  "vuln": [],
  "description": "Medium construct, CR 1 (200 XP)",
  "features": [
   "Antimagic Susceptibility|The armor is incapacitated while in the area of an antimagic field. If targeted by dispel magic, the armor must succeed on a Constitution saving throw against the caster's spell save DC or fall unconscious for 1 minute.",
   "False Appearance|While the armor remains motionless, it is indistinguishable from a normal suit of armor."
  ]
 },
 "ankheg": {
  "cr": 2,
  "ac": 14,
  "hp": 39,
  "hp_roll": "6d10+6",
  "str": 17,
  "dex": 11,
  "con": 13,
  "int": 1,
  "wis": 13,
  "cha": 6,
  "speed": 30,
  "darkvision": 60,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 2 (450 XP)"
 },
 "ape": {
  "cr": 0.5,
  "ac": 12,
  "hp": 19,
  "hp_roll": "3d8+6",
  "str": 16,
  "dex": 14,
  "con": 14,
  "int": 6,
  "wis": 12,
  "cha": 7,
  "speed": 30,
  "skill_prof": [
   "athletics",
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.5 (100 XP)"
 },
 "archmage": {
  "cr": 12,
  "ac": 12,
  "hp": 99,
  "hp_roll": "18d8+18",
  "str": 10,
  "dex": 14,
  "con": 12,
  "int": 20,
  "wis": 15,
  "cha": 16,
  "speed": 30,
  "save_prof": [
   "int",
   "wis"
  ],
  "skill_prof": [
   "arcana",
   "history"
  ],
  "languages": [
   "any six languages"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 12 (8400 XP)",
  "features": [
   "Magic Resistance|The archmage has advantage on saving throws against spells and other magical effects.",
   "Spellcasting|The archmage is an 18th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 17, +9 to hit with spell attacks). The archmage can cast disguise self and invisibility at will and has the following wizard spells prepared:"
  ]
 },
 "assassin": {
  "cr": 8,
  "ac": 15,
  "hp": 78,
  "hp_roll": "12d8+24",
  "str": 11,
  "dex": 16,
  "con": 14,
  "int": 13,
  "wis": 11,
  "cha": 10,
  "speed": 30,
  "save_prof": [
   "dex",
   "int"
  ],
  "skill_prof": [
   "acrobatics",
   "deception",
   "perception",
   "stealth"
  ],
  "languages": [
   "Thieves' cant plus any two languages"
  ],
  "resist": [
   "poison"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 8 (3900 XP)",
  "features": [
   "Assassinate|During its first turn, the assassin has advantage on attack rolls against any creature that hasn't taken a turn. Any hit the assassin scores against a surprised creature is a critical hit.",
   "Evasion|If the assassin is subjected to an effect that allows it to make a Dexterity saving throw to take only half damage, the assassin instead takes no damage if it succeeds on the saving throw, and only half damage if it fails.",
   "Sneak Attack (1/Turn)|The assassin deals an extra 13 (4d6) damage when it hits a target with a weapon attack and has advantage on the attack roll, or when the target is within 5 ft. of an ally of the assassin that isn't incapacitated and the assassin doesn't have disadvantage on the attack roll."
  ]
 },
 "awakened-shrub": {
  "cr": 0,
  "ac": 9,
  "hp": 10,
  "hp_roll": "3d6",
  "str": 3,
  "dex": 8,
  "con": 11,
  "int": 10,
  "wis": 10,
  "cha": 6,
  "speed": 20,
  "languages": [
   "one language known by its creator"
  ],
  "resist": [
   "piercing"
  ],
  "immune": [],
  "vuln": [
   "fire"
  ],
  "description": "Small plant, CR 0 (10 XP)",
  "features": [
   "False Appearance|While the shrub remains motionless, it is indistinguishable from a normal shrub."
  ]
 },
 "awakened-tree": {
  "cr": 2,
  "ac": 13,
  "hp": 59,
  "hp_roll": "7d12+14",
  "str": 19,
  "dex": 6,
  "con": 15,
  "int": 10,
  "wis": 10,
  "cha": 7,
  "speed": 20,
  "languages": [
   "one language known by its creator"
  ],
  "resist": [
   "piercing",
   "bludgeoning"
  ],
  "immune": [],
  "vuln": [
   "fire"
  ],
  "description": "Huge plant, CR 2 (450 XP)",
  "features": [
   "False Appearance|While the tree remains motionless, it is indistinguishable from a normal tree."
  ]
 },
 "axe-beak": {
  "cr": 0.25,
  "ac": 11,
  "hp": 19,
  "hp_roll": "3d10+3",
  "str": 14,
  "dex": 12,
  "con": 12,
  "int": 2,
  "wis": 10,
  "cha": 5,
  "speed": 50,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 0.25 (50 XP)"
 },
 "azer": {
  "cr": 2,
  "ac": 15,
  "hp": 39,
  "hp_roll": "6d8+12",
  "str": 17,
  "dex": 12,
  "con": 15,
  "int": 12,
  "wis": 13,
  "cha": 10,
  "speed": 30,
  "save_prof": [
   "con"
  ],
  "languages": [
   "Ignan"
  ],
  "resist": [],
  "immune": [
   "fire",
   "poison"
  ],
  "vuln": [],
  "description": "Medium elemental, CR 2 (450 XP)",
  "features": [
   "Heated Body|A creature that touches the azer or hits it with a melee attack while within 5 ft. of it takes 5 (1d10) fire damage.",
   "Heated Weapons|When the azer hits with a metal melee weapon, it deals an extra 3 (1d6) fire damage (included in the attack).",
   "Illumination|The azer sheds bright light in a 10-foot radius and dim light for an additional 10 ft.."
  ]
 },
 "baboon": {
  "cr": 0,
  "ac": 12,
  "hp": 3,
  "hp_roll": "1d6",
  "str": 8,
  "dex": 14,
  "con": 11,
  "int": 4,
  "wis": 12,
  "cha": 6,
  "speed": 30,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Small beast, CR 0 (10 XP)",
  "features": [
   "Pack Tactics|The baboon has advantage on an attack roll against a creature if at least one of the baboon's allies is within 5 ft. of the creature and the ally isn't incapacitated."
  ]
 },
 "badger": {
  "cr": 0,
  "ac": 10,
  "hp": 3,
  "hp_roll": "1d4+1",
  "str": 4,
  "dex": 11,
  "con": 12,
  "int": 2,
  "wis": 12,
  "cha": 5,
  "speed": 20,
  "darkvision": 30,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0 (10 XP)",
  "features": [
   "Keen Smell|The badger has advantage on Wisdom (Perception) checks that rely on smell."
  ]
 },
 "balor": {
  "cr": 19,
  "ac": 19,
  "hp": 262,
  "hp_roll": "21d12+126",
  "str": 26,
  "dex": 15,
  "con": 22,
  "int": 20,
  "wis": 16,
  "cha": 22,
  "speed": 40,
  "save_prof": [
   "str",
   "con",
   "wis",
   "cha"
  ],
  "languages": [
   "Abyssal",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "cold",
   "lightning"
  ],
  "immune": [
   "fire",
   "poison"
  ],
  "vuln": [],
  "description": "Huge fiend, CR 19 (22000 XP)",
  "features": [
   "Death Throes|When the balor dies, it explodes, and each creature within 30 feet of it must make a DC 20 Dexterity saving throw, taking 70 (20d6) fire damage on a failed save, or half as much damage on a successful one. The explosion ignites flammable objects in that area that aren't being worn or carried, and it destroys the balor's weapons.",
   "Fire Aura|At the start of each of the balor's turns, each creature within 5 feet of it takes 10 (3d6) fire damage, and flammable objects in the aura that aren't being worn or carried ignite. A creature that touches the balor or hits it with a melee attack while within 5 feet of it takes 10 (3d6) fire damage.",
   "Magic Resistance|The balor has advantage on saving throws against spells and other magical effects.",
   "Magic Weapons|The balor's weapon attacks are magical."
  ]
 },
 "bandit": {
  "cr": 0.125,
  "ac": 12,
  "hp": 11,
  "hp_roll": "2d8+2",
  "str": 11,
  "dex": 12,
  "con": 12,
  "int": 10,
  "wis": 10,
  "cha": 10,
  "speed": 30,
  "languages": [
   "any one language (usually Common)"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.125 (25 XP)"
 },
 "bandit-captain": {
  "cr": 2,
  "ac": 15,
  "hp": 65,
  "hp_roll": "10d8+20",
  "str": 15,
  "dex": 16,
  "con": 14,
  "int": 14,
  "wis": 11,
  "cha": 14,
  "speed": 30,
  "save_prof": [
   "str",
   "dex",
   "wis"
  ],
  "skill_prof": [
   "athletics",
   "deception"
  ],
  "languages": [
   "any two languages"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 2 (450 XP)"
 },
 "barbed-devil": {
  "cr": 5,
  "ac": 15,
  "hp": 110,
  "hp_roll": "13d8+52",
  "str": 16,
  "dex": 17,
  "con": 18,
  "int": 12,
  "wis": 14,
  "cha": 14,
  "speed": 30,
  "darkvision": 120,
  "save_prof": [
   "str",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "deception",
   "insight",
   "perception"
  ],
  "languages": [
   "Infernal",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "cold"
  ],
  "immune": [
   "fire",
   "poison"
  ],
  "vuln": [],
  "description": "Medium fiend, CR 5 (1800 XP)",
  "features": [
   "Barbed Hide|At the start of each of its turns, the barbed devil deals 5 (1d10) piercing damage to any creature grappling it.",
   "Devil's Sight|Magical darkness doesn't impede the devil's darkvision.",
   "Magic Resistance|The devil has advantage on saving throws against spells and other magical effects."
  ]
 },
 "basilisk": {
  "cr": 3,
  "ac": 12,
  "hp": 52,
  "hp_roll": "8d8+16",
  "str": 16,
  "dex": 8,
  "con": 15,
  "int": 2,
  "wis": 8,
  "cha": 7,
  "speed": 20,
  "darkvision": 60,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium monstrosity, CR 3 (700 XP)",
  "features": [
   "Petrifying Gaze|If a creature starts its turn within 30 ft. of the basilisk and the two of them can see each other, the basilisk can force the creature to make a DC 12 Constitution saving throw if the basilisk isn't incapacitated. On a failed save, the creature magically begins to turn to stone and is restrained. It must repeat the saving throw at the end of its next turn. On a success, the effect ends. On a failure, the creature is petrified until freed by the greater restoration spell or other magic."
  ]
 },
 "bat": {
  "cr": 0,
  "ac": 12,
  "hp": 1,
  "hp_roll": "1d4-1",
  "str": 2,
  "dex": 15,
  "con": 8,
  "int": 2,
  "wis": 12,
  "cha": 4,
  "speed": 5,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0 (10 XP)",
  "features": [
   "Echolocation|The bat can't use its blindsight while deafened.",
   "Keen Hearing|The bat has advantage on Wisdom (Perception) checks that rely on hearing."
  ]
 },
 "bearded-devil": {
  "cr": 3,
  "ac": 13,
  "hp": 52,
  "hp_roll": "8d8+16",
  "str": 16,
  "dex": 15,
  "con": 15,
  "int": 9,
  "wis": 11,
  "cha": 11,
  "speed": 30,
  "darkvision": 120,
  "save_prof": [
   "str",
   "con",
   "wis"
  ],
  "languages": [
   "Infernal",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "cold"
  ],
  "immune": [
   "fire",
   "poison"
  ],
  "vuln": [],
  "description": "Medium fiend, CR 3 (700 XP)",
  "features": [
   "Devil's Sight|Magical darkness doesn't impede the devil's darkvision.",
   "Magic Resistance|The devil has advantage on saving throws against spells and other magical effects.",
   "Steadfast|The devil can't be frightened while it can see an allied creature within 30 feet of it."
  ]
 },
 "behir": {
  "cr": 11,
  "ac": 17,
  "hp": 168,
  "hp_roll": "16d12+64",
  "str": 23,
  "dex": 16,
  "con": 18,
  "int": 7,
  "wis": 14,
  "cha": 12,
  "speed": 50,
  "darkvision": 90,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "lightning"
  ],
  "vuln": [],
  "description": "Huge monstrosity, CR 11 (7200 XP)"
 },
 "berserker": {
  "cr": 2,
  "ac": 13,
  "hp": 67,
  "hp_roll": "9d8+27",
  "str": 16,
  "dex": 12,
  "con": 17,
  "int": 9,
  "wis": 11,
  "cha": 9,
  "speed": 30,
  "languages": [
   "any one language (usually Common)"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 2 (450 XP)",
  "features": [
   "Reckless|At the start of its turn, the berserker can gain advantage on all melee weapon attack rolls during that turn, but attack rolls against it have advantage until the start of its next turn."
  ]
 },
 "black-bear": {
  "cr": 0.5,
  "ac": 11,
  "hp": 19,
  "hp_roll": "3d8+6",
  "str": 15,
  "dex": 10,
  "con": 14,
  "int": 2,
  "wis": 12,
  "cha": 7,
  "speed": 40,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.5 (100 XP)",
  "features": [
   "Keen Smell|The bear has advantage on Wisdom (Perception) checks that rely on smell."
  ]
 },
 "black-dragon-wyrmling": {
  "cr": 2,
  "ac": 17,
  "hp": 33,
  "hp_roll": "6d8+6",
  "str": 15,
  "dex": 14,
  "con": 13,
  "int": 10,
  "wis": 11,
  "cha": 13,
  "speed": 30,
  "darkvision": 60,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "acid"
  ],
  "vuln": [],
  "description": "Medium dragon, CR 2 (450 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water."
  ]
 },
 "black-pudding": {
  "cr": 4,
  "ac": 7,
  "hp": 85,
  "hp_roll": "10d10+30",
  "str": 16,
  "dex": 5,
  "con": 16,
  "int": 1,
  "wis": 6,
  "cha": 1,
  "speed": 20,
  "resist": [],
  "immune": [
   "slashing",
   "cold",
   "acid",
   "lightning"
  ],
  "vuln": [],
  "description": "Large ooze, CR 4 (1100 XP)",
  "features": [
   "Amorphous|The pudding can move through a space as narrow as 1 inch wide without squeezing.",
   "Corrosive Form|A creature that touches the pudding or hits it with a melee attack while within 5 feet of it takes 4 (1d8) acid damage. Any nonmagical weapon made of metal or wood that hits the pudding corrodes. After dealing damage, the weapon takes a permanent and cumulative -1 penalty to damage rolls. If its penalty drops to -5, the weapon is destroyed. Nonmagical ammunition made of metal or wood that hits the pudding is destroyed after dealing damage. The pudding can eat through 2-inch-thick, nonmagical wood or metal in 1 round.",
   "Spider Climb|The pudding can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check."
  ]
 },
 "blink-dog": {
  "cr": 0.25,
  "ac": 13,
  "hp": 22,
  "hp_roll": "4d8+4",
  "str": 12,
  "dex": 17,
  "con": 12,
  "int": 10,
  "wis": 13,
  "cha": 11,
  "speed": 40,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Blink Dog",
   "understands Sylvan but can't speak it"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium fey, CR 0.25 (50 XP)",
  "features": [
   "Keen Hearing and Smell|The dog has advantage on Wisdom (Perception) checks that rely on hearing or smell."
  ]
 },
 "blood-hawk": {
  "cr": 0.125,
  "ac": 12,
  "hp": 7,
  "hp_roll": "2d6",
  "str": 6,
  "dex": 14,
  "con": 10,
  "int": 3,
  "wis": 14,
  "cha": 5,
  "speed": 10,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Small beast, CR 0.125 (25 XP)",
  "features": [
   "Keen Sight|The hawk has advantage on Wisdom (Perception) checks that rely on sight.",
   "Pack Tactics|The hawk has advantage on an attack roll against a creature if at least one of the hawk's allies is within 5 ft. of the creature and the ally isn't incapacitated."
  ]
 },
 "blue-dragon-wyrmling": {
  "cr": 3,
  "ac": 17,
  "hp": 52,
  "hp_roll": "8d8+16",
  "str": 17,
  "dex": 10,
  "con": 15,
  "int": 12,
  "wis": 11,
  "cha": 15,
  "speed": 30,
  "darkvision": 60,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "lightning"
  ],
  "vuln": [],
  "description": "Medium dragon, CR 3 (700 XP)"
 },
 "boar": {
  "cr": 0.25,
  "ac": 11,
  "hp": 11,
  "hp_roll": "2d8+2",
  "str": 13,
  "dex": 11,
  "con": 12,
  "int": 2,
  "wis": 9,
  "cha": 5,
  "speed": 40,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.25 (50 XP)",
  "features": [
   "Charge|If the boar moves at least 20 ft. straight toward a target and then hits it with a tusk attack on the same turn, the target takes an extra 3 (1d6) slashing damage. If the target is a creature, it must succeed on a DC 11 Strength saving throw or be knocked prone.",
   "Relentless|If the boar takes 7 damage or less that would reduce it to 0 hit points, it is reduced to 1 hit point instead."
  ]
 },
 "bone-devil": {
  "cr": 9,
  "ac": 19,
  "hp": 142,
  "hp_roll": "15d10+60",
  "str": 18,
  "dex": 16,
  "con": 18,
  "int": 13,
  "wis": 14,
  "cha": 16,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "int",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "deception",
   "insight"
  ],
  "languages": [
   "Infernal",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "cold"
  ],
  "immune": [
   "fire",
   "poison"
  ],
  "vuln": [],
  "description": "Large fiend, CR 9 (5000 XP)",
  "features": [
   "Devil's Sight|Magical darkness doesn't impede the devil's darkvision.",
   "Magic Resistance|The devil has advantage on saving throws against spells and other magical effects."
  ]
 },
 "brass-dragon-wyrmling": {
  "cr": 1,
  "ac": 16,
  "hp": 16,
  "hp_roll": "3d8+3",
  "str": 15,
  "dex": 10,
  "con": 13,
  "int": 10,
  "wis": 11,
  "cha": 13,
  "speed": 30,
  "darkvision": 60,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Medium dragon, CR 1 (100 XP)"
 },
 "bronze-dragon-wyrmling": {
  "cr": 2,
  "ac": 17,
  "hp": 32,
  "hp_roll": "5d8+10",
  "str": 17,
  "dex": 10,
  "con": 15,
  "int": 12,
  "wis": 11,
  "cha": 15,
  "speed": 30,
  "darkvision": 60,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "lightning"
  ],
  "vuln": [],
  "description": "Medium dragon, CR 2 (450 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water."
  ]
 },
 "brown-bear": {
  "cr": 1,
  "ac": 11,
  "hp": 34,
  "hp_roll": "4d10+12",
  "str": 19,
  "dex": 10,
  "con": 16,
  "int": 2,
  "wis": 13,
  "cha": 7,
  "speed": 40,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 1 (200 XP)",
  "features": [
   "Keen Smell|The bear has advantage on Wisdom (Perception) checks that rely on smell."
  ]
 },
 "bugbear": {
  "cr": 1,
  "ac": 16,
  "hp": 27,
  "hp_roll": "5d8+5",
  "str": 15,
  "dex": 14,
  "con": 13,
  "int": 8,
  "wis": 11,
  "cha": 9,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "stealth",
   "survival"
  ],
  "languages": [
   "Common",
   "Goblin"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 1 (200 XP)",
  "features": [
   "Brute|A melee weapon deals one extra die of its damage when the bugbear hits with it (included in the attack).",
   "Surprise Attack|If the bugbear surprises a creature and hits it with an attack during the first round of combat, the target takes an extra 7 (2d6) damage from the attack."
  ]
 },
 "bulette": {
  "cr": 5,
  "ac": 17,
  "hp": 94,
  "hp_roll": "9d10+45",
  "str": 19,
  "dex": 11,
  "con": 21,
  "int": 2,
  "wis": 10,
  "cha": 5,
  "speed": 40,
  "darkvision": 60,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 5 (1800 XP)",
  "features": [
   "Standing Leap|The bulette's long jump is up to 30 ft. and its high jump is up to 15 ft., with or without a running start."
  ]
 },
 "camel": {
  "cr": 0.125,
  "ac": 9,
  "hp": 15,
  "hp_roll": "2d10+4",
  "str": 16,
  "dex": 8,
  "con": 14,
  "int": 2,
  "wis": 8,
  "cha": 5,
  "speed": 50,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 0.125 (25 XP)"
 },
 "cat": {
  "cr": 0,
  "ac": 12,
  "hp": 2,
  "hp_roll": "1d4",
  "str": 3,
  "dex": 15,
  "con": 10,
  "int": 3,
  "wis": 12,
  "cha": 7,
  "speed": 40,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0 (10 XP)",
  "features": [
   "Keen Smell|The cat has advantage on Wisdom (Perception) checks that rely on smell."
  ]
 },
 "centaur": {
  "cr": 2,
  "ac": 12,
  "hp": 45,
  "hp_roll": "6d10+12",
  "str": 18,
  "dex": 14,
  "con": 14,
  "int": 9,
  "wis": 13,
  "cha": 11,
  "speed": 50,
  "skill_prof": [
   "athletics",
   "perception",
   "survival"
  ],
  "languages": [
   "Elvish",
   "Sylvan"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 2 (450 XP)",
  "features": [
   "Charge|If the centaur moves at least 30 ft. straight toward a target and then hits it with a pike attack on the same turn, the target takes an extra 10 (3d6) piercing damage."
  ]
 },
 "chain-devil": {
  "cr": 8,
  "ac": 16,
  "hp": 85,
  "hp_roll": "10d8+40",
  "str": 18,
  "dex": 15,
  "con": 18,
  "int": 11,
  "wis": 12,
  "cha": 14,
  "speed": 30,
  "darkvision": 120,
  "save_prof": [
   "con",
   "wis",
   "cha"
  ],
  "languages": [
   "Infernal",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "cold"
  ],
  "immune": [
   "fire",
   "poison"
  ],
  "vuln": [],
  "description": "Medium fiend, CR 8 (3900 XP)",
  "features": [
   "Devil's Sight|Magical darkness doesn't impede the devil's darkvision.",
   "Magic Resistance|The devil has advantage on saving throws against spells and other magical effects."
  ]
 },
 "chimera": {
  "cr": 6,
  "ac": 14,
  "hp": 114,
  "hp_roll": "12d10+48",
  "str": 19,
  "dex": 11,
  "con": 19,
  "int": 3,
  "wis": 14,
  "cha": 10,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "understands Draconic but can't speak"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 6 (2300 XP)"
 },
 "chuul": {
  "cr": 4,
  "ac": 16,
  "hp": 93,
  "hp_roll": "11d10+33",
  "str": 19,
  "dex": 10,
  "con": 16,
  "int": 5,
  "wis": 11,
  "cha": 5,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "understands Deep Speech but can't speak"
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Large aberration, CR 4 (1100 XP)",
  "features": [
   "Amphibious|The chuul can breathe air and water.",
   "Sense Magic|The chuul senses magic within 120 feet of it at will. This trait otherwise works like the detect magic spell but isn't itself magical."
  ]
 },
 "clay-golem": {
  "cr": 9,
  "ac": 14,
  "hp": 133,
  "hp_roll": "14d10+56",
  "str": 20,
  "dex": 9,
  "con": 18,
  "int": 3,
  "wis": 8,
  "cha": 1,
  "speed": 20,
  "darkvision": 60,
  "languages": [
   "understands the languages of its creator but can't speak"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing",
   "acid",
   "poison",
   "psychic"
  ],
  "vuln": [],
  "description": "Large construct, CR 9 (5000 XP)",
  "features": [
   "Acid Absorption|Whenever the golem is subjected to acid damage, it takes no damage and instead regains a number of hit points equal to the acid damage dealt.",
   "Berserk|Whenever the golem starts its turn with 60 hit points or fewer, roll a d6. On a 6, the golem goes berserk. On each of its turns while berserk, the golem attacks the nearest creature it can see. If no creature is near enough to move to and attack, the golem attacks an object, with preference for an object smaller than itself. Once the golem goes berserk, it continues to do so until it is destroyed or regains all its hit points.",
   "Immutable Form|The golem is immune to any spell or effect that would alter its form.",
   "Magic Resistance|The golem has advantage on saving throws against spells and other magical effects.",
   "Magic Weapons|The golem's weapon attacks are magical."
  ]
 },
 "cloaker": {
  "cr": 8,
  "ac": 14,
  "hp": 78,
  "hp_roll": "12d10+12",
  "str": 17,
  "dex": 15,
  "con": 12,
  "int": 13,
  "wis": 12,
  "cha": 14,
  "speed": 10,
  "darkvision": 60,
  "skill_prof": [
   "stealth"
  ],
  "languages": [
   "Deep Speech",
   "Undercommon"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large aberration, CR 8 (3900 XP)",
  "features": [
   "Damage Transfer|While attached to a creature, the cloaker takes only half the damage dealt to it (rounded down). and that creature takes the other half.",
   "False Appearance|While the cloaker remains motionless without its underside exposed, it is indistinguishable from a dark leather cloak.",
   "Light Sensitivity|While in bright light, the cloaker has disadvantage on attack rolls and Wisdom (Perception) checks that rely on sight."
  ]
 },
 "cloud-giant": {
  "cr": 9,
  "ac": 14,
  "hp": 200,
  "hp_roll": "16d12+96",
  "str": 27,
  "dex": 10,
  "con": 22,
  "int": 12,
  "wis": 16,
  "cha": 16,
  "speed": 40,
  "save_prof": [
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "insight",
   "perception"
  ],
  "languages": [
   "Common",
   "Giant"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Huge giant, CR 9 (5000 XP)",
  "features": [
   "Keen Smell|The giant has advantage on Wisdom (Perception) checks that rely on smell.",
   "Innate Spellcasting|The giant's innate spellcasting ability is Charisma. It can innately cast the following spells, requiring no material components:"
  ]
 },
 "cockatrice": {
  "cr": 0.5,
  "ac": 11,
  "hp": 27,
  "hp_roll": "6d6+6",
  "str": 6,
  "dex": 12,
  "con": 12,
  "int": 2,
  "wis": 13,
  "cha": 5,
  "speed": 20,
  "darkvision": 60,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Small monstrosity, CR 0.5 (100 XP)"
 },
 "commoner": {
  "cr": 0,
  "ac": 10,
  "hp": 4,
  "hp_roll": "1d8",
  "str": 10,
  "dex": 10,
  "con": 10,
  "int": 10,
  "wis": 10,
  "cha": 10,
  "speed": 30,
  "languages": [
   "any one language (usually Common)"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0 (10 XP)"
 },
 "constrictor-snake": {
  "cr": 0.25,
  "ac": 12,
  "hp": 13,
  "hp_roll": "2d10+2",
  "str": 15,
  "dex": 14,
  "con": 12,
  "int": 1,
  "wis": 10,
  "cha": 3,
  "speed": 30,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 0.25 (50 XP)"
 },
 "copper-dragon-wyrmling": {
  "cr": 1,
  "ac": 16,
  "hp": 22,
  "hp_roll": "4d8+4",
  "str": 15,
  "dex": 12,
  "con": 13,
  "int": 14,
  "wis": 11,
  "cha": 13,
  "speed": 30,
  "darkvision": 60,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "acid"
  ],
  "vuln": [],
  "description": "Medium dragon, CR 1 (200 XP)"
 },
 "couatl": {
  "cr": 4,
  "ac": 19,
  "hp": 97,
  "hp_roll": "13d8+39",
  "str": 16,
  "dex": 20,
  "con": 17,
  "int": 18,
  "wis": 20,
  "cha": 18,
  "speed": 30,
  "save_prof": [
   "con",
   "wis",
   "cha"
  ],
  "languages": [
   "all",
   "telepathy 120 ft."
  ],
  "resist": [
   "radiant"
  ],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing",
   "psychic"
  ],
  "vuln": [],
  "description": "Medium celestial, CR 4 (1100 XP)",
  "features": [
   "Innate Spellcasting|The couatl's spellcasting ability is Charisma (spell save DC 14). It can innately cast the following spells, requiring only verbal components:",
   "Magic Weapons|The couatl's weapon attacks are magical.",
   "Shielded Mind|The couatl is immune to scrying and to any effect that would sense its emotions, read its thoughts, or detect its location."
  ]
 },
 "crab": {
  "cr": 0,
  "ac": 11,
  "hp": 2,
  "hp_roll": "1d4",
  "str": 2,
  "dex": 11,
  "con": 10,
  "int": 1,
  "wis": 8,
  "cha": 2,
  "speed": 20,
  "skill_prof": [
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0 (10 XP)",
  "features": [
   "Amphibious|The crab can breathe air and water."
  ]
 },
 "crocodile": {
  "cr": 0.5,
  "ac": 12,
  "hp": 19,
  "hp_roll": "3d10+3",
  "str": 15,
  "dex": 10,
  "con": 13,
  "int": 2,
  "wis": 10,
  "cha": 5,
  "speed": 20,
  "skill_prof": [
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 0.5 (100 XP)",
  "features": [
   "Hold Breath|The crocodile can hold its breath for 15 minutes."
  ]
 },
 "cult-fanatic": {
  "cr": 2,
  "ac": 13,
  "hp": 22,
  "hp_roll": "6d8-5",
  "str": 11,
  "dex": 14,
  "con": 12,
  "int": 10,
  "wis": 13,
  "cha": 14,
  "speed": 30,
  "skill_prof": [
   "deception",
   "persuasion",
   "religion"
  ],
  "languages": [
   "any one language (usually Common)"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 2 (450 XP)",
  "features": [
   "Dark Devotion|The fanatic has advantage on saving throws against being charmed or frightened.",
   "Spellcasting|The fanatic is a 4th-level spellcaster. Its spell casting ability is Wisdom (spell save DC 11, +3 to hit with spell attacks). The fanatic has the following cleric spells prepared:"
  ]
 },
 "cultist": {
  "cr": 0.125,
  "ac": 12,
  "hp": 9,
  "hp_roll": "2d8",
  "str": 11,
  "dex": 12,
  "con": 10,
  "int": 10,
  "wis": 11,
  "cha": 10,
  "speed": 30,
  "skill_prof": [
   "deception",
   "religion"
  ],
  "languages": [
   "any one language (usually Common)"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.125 (25 XP)",
  "features": [
   "Dark Devotion|The cultist has advantage on saving throws against being charmed or frightened."
  ]
 },
 "darkmantle": {
  "cr": 0.5,
  "ac": 11,
  "hp": 22,
  "hp_roll": "5d6+5",
  "str": 16,
  "dex": 12,
  "con": 13,
  "int": 2,
  "wis": 10,
  "cha": 5,
  "speed": 10,
  "skill_prof": [
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Small monstrosity, CR 0.5 (100 XP)",
  "features": [
   "Echolocation|The darkmantle can't use its blindsight while deafened.",
   "False Appearance|While the darkmantle remains motionless, it is indistinguishable from a cave formation such as a stalactite or stalagmite."
  ]
 },
 "death-dog": {
  "cr": 1,
  "ac": 12,
  "hp": 39,
  "hp_roll": "6d8+12",
  "str": 15,
  "dex": 14,
  "con": 14,
  "int": 3,
  "wis": 13,
  "cha": 6,
  "speed": 40,
  "darkvision": 120,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium monstrosity, CR 1 (200 XP)",
  "features": [
   "Two-Headed|The dog has advantage on Wisdom (Perception) checks and on saving throws against being blinded, charmed, deafened, frightened, stunned, or knocked unconscious."
  ]
 },
 "deep-gnome-svirfneblin": {
  "cr": 0.5,
  "ac": 15,
  "hp": 16,
  "hp_roll": "3d6+6",
  "str": 15,
  "dex": 14,
  "con": 14,
  "int": 12,
  "wis": 10,
  "cha": 9,
  "speed": 20,
  "darkvision": 120,
  "skill_prof": [
   "investigation",
   "perception",
   "stealth"
  ],
  "languages": [
   "Gnomish",
   "Terran",
   "Undercommon"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Small humanoid, CR 0.5 (50 XP)",
  "features": [
   "Stone Camouflage|The gnome has advantage on Dexterity (Stealth) checks made to hide in rocky terrain.",
   "Gnome Cunning|The gnome has advantage on Intelligence, Wisdom, and Charisma saving throws against magic.",
   "Innate Spellcasting|The gnome's innate spellcasting ability is Intelligence (spell save DC 11). It can innately cast the following spells, requiring no material components:"
  ]
 },
 "deer": {
  "cr": 0,
  "ac": 13,
  "hp": 4,
  "hp_roll": "1d8",
  "str": 11,
  "dex": 16,
  "con": 11,
  "int": 2,
  "wis": 14,
  "cha": 5,
  "speed": 50,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0 (10 XP)"
 },
 "deva": {
  "cr": 10,
  "ac": 17,
  "hp": 136,
  "hp_roll": "16d8+64",
  "str": 18,
  "dex": 18,
  "con": 18,
  "int": 17,
  "wis": 20,
  "cha": 20,
  "speed": 30,
  "darkvision": 120,
  "save_prof": [
   "wis",
   "cha"
  ],
  "skill_prof": [
   "insight",
   "perception"
  ],
  "languages": [
   "all",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "radiant"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium celestial, CR 10 (5900 XP)",
  "features": [
   "Angelic Weapons|The deva's weapon attacks are magical. When the deva hits with any weapon, the weapon deals an extra 4d8 radiant damage (included in the attack).",
   "Innate Spellcasting|The deva's spellcasting ability is Charisma (spell save DC 17). The deva can innately cast the following spells, requiring only verbal components:",
   "Magic Resistance|The deva has advantage on saving throws against spells and other magical effects."
  ]
 },
 "dire-wolf": {
  "cr": 1,
  "ac": 14,
  "hp": 37,
  "hp_roll": "5d10+10",
  "str": 17,
  "dex": 15,
  "con": 15,
  "int": 3,
  "wis": 12,
  "cha": 7,
  "speed": 50,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 1 (200 XP)",
  "features": [
   "Keen Hearing and Smell|The wolf has advantage on Wisdom (Perception) checks that rely on hearing or smell.",
   "Pack Tactics|The wolf has advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 ft. of the creature and the ally isn't incapacitated."
  ]
 },
 "djinni": {
  "cr": 11,
  "ac": 17,
  "hp": 161,
  "hp_roll": "14d10+84",
  "str": 21,
  "dex": 15,
  "con": 22,
  "int": 15,
  "wis": 16,
  "cha": 20,
  "speed": 30,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "wis",
   "cha"
  ],
  "languages": [
   "Auran"
  ],
  "resist": [],
  "immune": [
   "lightning",
   "thunder"
  ],
  "vuln": [],
  "description": "Large elemental, CR 11 (7200 XP)",
  "features": [
   "Elemental Demise|If the djinni dies, its body disintegrates into a warm breeze, leaving behind only equipment the djinni was wearing or carrying.",
   "Innate Spellcasting|The djinni's innate spellcasting ability is Charisma (spell save DC 17, +9 to hit with spell attacks). It can innately cast the following spells, requiring no material components:"
  ]
 },
 "doppelganger": {
  "cr": 3,
  "ac": 14,
  "hp": 52,
  "hp_roll": "8d8+16",
  "str": 11,
  "dex": 18,
  "con": 14,
  "int": 11,
  "wis": 12,
  "cha": 14,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "deception",
   "insight"
  ],
  "languages": [
   "Common"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium monstrosity, CR 3 (700 XP)",
  "features": [
   "Shapechanger|The doppelganger can use its action to polymorph into a Small or Medium humanoid it has seen, or back into its true form. Its statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Ambusher|In the first round of combat, the doppelganger has advantage on attack rolls against any creature it has surprised.",
   "Surprise Attack|If the doppelganger surprises a creature and hits it with an attack during the first round of combat, the target takes an extra 10 (3d6) damage from the attack."
  ]
 },
 "draft-horse": {
  "cr": 0.25,
  "ac": 10,
  "hp": 19,
  "hp_roll": "3d10+3",
  "str": 18,
  "dex": 10,
  "con": 12,
  "int": 2,
  "wis": 11,
  "cha": 7,
  "speed": 40,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 0.25 (50 XP)"
 },
 "dragon-turtle": {
  "cr": 17,
  "ac": 20,
  "hp": 341,
  "hp_roll": "22d20+110",
  "str": 25,
  "dex": 10,
  "con": 20,
  "int": 10,
  "wis": 12,
  "cha": 12,
  "speed": 20,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis"
  ],
  "languages": [
   "Aquan",
   "Draconic"
  ],
  "resist": [
   "fire"
  ],
  "immune": [],
  "vuln": [],
  "description": "Gargantuan dragon, CR 17 (18000 XP)",
  "features": [
   "Amphibious|The dragon turtle can breathe air and water."
  ]
 },
 "dretch": {
  "cr": 0.25,
  "ac": 11,
  "hp": 18,
  "hp_roll": "4d6+4",
  "str": 11,
  "dex": 11,
  "con": 12,
  "int": 5,
  "wis": 8,
  "cha": 3,
  "speed": 20,
  "darkvision": 60,
  "languages": [
   "Abyssal",
   "telepathy 60 ft. (works only with creatures that understand Abyssal)"
  ],
  "resist": [
   "fire",
   "cold",
   "lightning"
  ],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Small fiend, CR 0.25 (25 XP)"
 },
 "drider": {
  "cr": 6,
  "ac": 19,
  "hp": 123,
  "hp_roll": "13d10+52",
  "str": 16,
  "dex": 16,
  "con": 18,
  "int": 13,
  "wis": 14,
  "cha": 12,
  "speed": 30,
  "darkvision": 120,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Elvish",
   "Undercommon"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 6 (2300 XP)",
  "features": [
   "Fey Ancestry|The drider has advantage on saving throws against being charmed, and magic can't put the drider to sleep.",
   "Innate Spellcasting|The drider's innate spellcasting ability is Wisdom (spell save DC 13). The drider can innately cast the following spells, requiring no material components:",
   "Spider Climb|The drider can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.",
   "Sunlight Sensitivity|While in sunlight, the drider has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.",
   "Web Walker|The drider ignores movement restrictions caused by webbing."
  ]
 },
 "drow": {
  "cr": 0.25,
  "ac": 15,
  "hp": 13,
  "hp_roll": "3d8",
  "str": 10,
  "dex": 14,
  "con": 10,
  "int": 11,
  "wis": 11,
  "cha": 12,
  "speed": 30,
  "darkvision": 120,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Elvish",
   "Undercommon"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.25 (50 XP)",
  "features": [
   "Fey Ancestry|The drow has advantage on saving throws against being charmed, and magic can't put the drow to sleep.",
   "Innate Spellcasting|The drow's spellcasting ability is Charisma (spell save DC 11). It can innately cast the following spells, requiring no material components:",
   "Sunlight Sensitivity|While in sunlight, the drow has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight."
  ]
 },
 "druid": {
  "cr": 2,
  "ac": 11,
  "hp": 27,
  "hp_roll": "5d8+5",
  "str": 10,
  "dex": 12,
  "con": 13,
  "int": 12,
  "wis": 15,
  "cha": 11,
  "speed": 30,
  "skill_prof": [
   "medicine",
   "nature",
   "perception"
  ],
  "languages": [
   "Druidic plus any two languages"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 2 (450 XP)",
  "features": [
   "Spellcasting|The druid is a 4th-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 12, +4 to hit with spell attacks). It has the following druid spells prepared:"
  ]
 },
 "dryad": {
  "cr": 1,
  "ac": 11,
  "hp": 22,
  "hp_roll": "5d8",
  "str": 10,
  "dex": 12,
  "con": 11,
  "int": 14,
  "wis": 15,
  "cha": 18,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Elvish",
   "Sylvan"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium fey, CR 1 (200 XP)",
  "features": [
   "Innate Spellcasting|The dryad's innate spellcasting ability is Charisma (spell save DC 14). The dryad can innately cast the following spells, requiring no material components:",
   "Magic Resistance|The dryad has advantage on saving throws against spells and other magical effects.",
   "Speak with Beasts and Plants|The dryad can communicate with beasts and plants as if they shared a language.",
   "Tree Stride|Once on her turn, the dryad can use 10 ft. of her movement to step magically into one living tree within her reach and emerge from a second living tree within 60 ft. of the first tree, appearing in an unoccupied space within 5 ft. of the second tree. Both trees must be large or bigger."
  ]
 },
 "duergar": {
  "cr": 1,
  "ac": 16,
  "hp": 26,
  "hp_roll": "4d8+8",
  "str": 14,
  "dex": 11,
  "con": 14,
  "int": 11,
  "wis": 10,
  "cha": 9,
  "speed": 25,
  "darkvision": 120,
  "languages": [
   "Dwarvish",
   "Undercommon"
  ],
  "resist": [
   "poison"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 1 (200 XP)",
  "features": [
   "Duergar Resilience|The duergar has advantage on saving throws against poison, spells, and illusions, as well as to resist being charmed or paralyzed.",
   "Sunlight Sensitivity|While in sunlight, the duergar has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight."
  ]
 },
 "dust-mephit": {
  "cr": 0.5,
  "ac": 12,
  "hp": 17,
  "hp_roll": "5d6",
  "str": 5,
  "dex": 14,
  "con": 10,
  "int": 9,
  "wis": 11,
  "cha": 10,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Auran",
   "Terran"
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [
   "fire"
  ],
  "description": "Small elemental, CR 0.5 (100 XP)",
  "features": [
   "Death Burst|When the mephit dies, it explodes in a burst of dust. Each creature within 5 ft. of it must then succeed on a DC 10 Constitution saving throw or be blinded for 1 minute. A blinded creature can repeat the saving throw on each of its turns, ending the effect on itself on a success.",
   "Innate Spellcasting|The mephit can innately cast sleep, requiring no material components. Its innate spellcasting ability is Charisma."
  ]
 },
 "eagle": {
  "cr": 0,
  "ac": 12,
  "hp": 3,
  "hp_roll": "1d6",
  "str": 6,
  "dex": 15,
  "con": 10,
  "int": 2,
  "wis": 14,
  "cha": 7,
  "speed": 10,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Small beast, CR 0 (10 XP)",
  "features": [
   "Keen Sight|The eagle has advantage on Wisdom (Perception) checks that rely on sight."
  ]
 },
 "earth-elemental": {
  "cr": 5,
  "ac": 17,
  "hp": 126,
  "hp_roll": "12d10+60",
  "str": 20,
  "dex": 8,
  "con": 20,
  "int": 5,
  "wis": 10,
  "cha": 5,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "Terran"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [
   "poison"
  ],
  "vuln": [
   "thunder"
  ],
  "description": "Large elemental, CR 5 (1800 XP)",
  "features": [
   "Earth Glide|The elemental can burrow through nonmagical, unworked earth and stone. While doing so, the elemental doesn't disturb the material it moves through.",
   "Siege Monster|The elemental deals double damage to objects and structures."
  ]
 },
 "efreeti": {
  "cr": 11,
  "ac": 17,
  "hp": 200,
  "hp_roll": "16d10+112",
  "str": 22,
  "dex": 12,
  "con": 24,
  "int": 16,
  "wis": 15,
  "cha": 16,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "int",
   "wis",
   "cha"
  ],
  "languages": [
   "Ignan"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Large elemental, CR 11 (7200 XP)",
  "features": [
   "Elemental Demise|If the efreeti dies, its body disintegrates in a flash of fire and puff of smoke, leaving behind only equipment the djinni was wearing or carrying.",
   "Innate Spellcasting|The efreeti's innate spell casting ability is Charisma (spell save DC 15, +7 to hit with spell attacks). It can innately cast the following spells, requiring no material components:"
  ]
 },
 "elephant": {
  "cr": 4,
  "ac": 12,
  "hp": 76,
  "hp_roll": "8d12+24",
  "str": 22,
  "dex": 9,
  "con": 17,
  "int": 3,
  "wis": 11,
  "cha": 6,
  "speed": 40,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Huge beast, CR 4 (1100 XP)",
  "features": [
   "Trampling Charge|If the elephant moves at least 20 ft. straight toward a creature and then hits it with a gore attack on the same turn, that target must succeed on a DC 12 Strength saving throw or be knocked prone. If the target is prone, the elephant can make one stomp attack against it as a bonus action."
  ]
 },
 "elk": {
  "cr": 0.25,
  "ac": 10,
  "hp": 13,
  "hp_roll": "2d10+2",
  "str": 16,
  "dex": 10,
  "con": 12,
  "int": 2,
  "wis": 10,
  "cha": 6,
  "speed": 50,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 0.25 (50 XP)",
  "features": [
   "Charge|If the elk moves at least 20 ft. straight toward a target and then hits it with a ram attack on the same turn, the target takes an extra 7 (2d6) damage. If the target is a creature, it must succeed on a DC 13 Strength saving throw or be knocked prone."
  ]
 },
 "erinyes": {
  "cr": 12,
  "ac": 18,
  "hp": 153,
  "hp_roll": "18d8+72",
  "str": 18,
  "dex": 16,
  "con": 18,
  "int": 14,
  "wis": 14,
  "cha": 18,
  "speed": 30,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "languages": [
   "Infernal",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "cold"
  ],
  "immune": [
   "fire",
   "poison"
  ],
  "vuln": [],
  "description": "Medium fiend, CR 12 (8400 XP)",
  "features": [
   "Hellish Weapons|The erinyes's weapon attacks are magical and deal an extra 13 (3d8) poison damage on a hit (included in the attacks).",
   "Magic Resistance|The erinyes has advantage on saving throws against spells and other magical effects."
  ]
 },
 "ettercap": {
  "cr": 2,
  "ac": 13,
  "hp": 44,
  "hp_roll": "8d8+8",
  "str": 14,
  "dex": 15,
  "con": 13,
  "int": 7,
  "wis": 12,
  "cha": 8,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth",
   "survival"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium monstrosity, CR 2 (450 XP)",
  "features": [
   "Spider Climb|The ettercap can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.",
   "Web Sense|While in contact with a web, the ettercap knows the exact location of any other creature in contact with the same web.",
   "Web Walker|The ettercap ignores movement restrictions caused by webbing."
  ]
 },
 "ettin": {
  "cr": 4,
  "ac": 12,
  "hp": 85,
  "hp_roll": "10d10+30",
  "str": 21,
  "dex": 8,
  "con": 17,
  "int": 6,
  "wis": 10,
  "cha": 8,
  "speed": 40,
  "darkvision": 60,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "Giant",
   "Orc"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large giant, CR 4 (1100 XP)",
  "features": [
   "Two Heads|The ettin has advantage on Wisdom (Perception) checks and on saving throws against being blinded, charmed, deafened, frightened, stunned, and knocked unconscious.",
   "Wakeful|When one of the ettin's heads is asleep, its other head is awake."
  ]
 },
 "fire-elemental": {
  "cr": 5,
  "ac": 13,
  "hp": 102,
  "hp_roll": "12d10+36",
  "str": 10,
  "dex": 17,
  "con": 16,
  "int": 6,
  "wis": 10,
  "cha": 7,
  "speed": 50,
  "darkvision": 60,
  "languages": [
   "Ignan"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [
   "fire",
   "poison"
  ],
  "vuln": [],
  "description": "Large elemental, CR 5 (1800 XP)",
  "features": [
   "Fire Form|The elemental can move through a space as narrow as 1 inch wide without squeezing. A creature that touches the elemental or hits it with a melee attack while within 5 ft. of it takes 5 (1d10) fire damage. In addition, the elemental can enter a hostile creature's space and stop there. The first time it enters a creature's space on a turn, that creature takes 5 (1d10) fire damage and catches fire; until someone takes an action to douse the fire, the creature takes 5 (1d10) fire damage at the start of each of its turns.",
   "Illumination|The elemental sheds bright light in a 30-foot radius and dim light in an additional 30 ft..",
   "Water Susceptibility|For every 5 ft. the elemental moves in water, or for every gallon of water splashed on it, it takes 1 cold damage."
  ]
 },
 "fire-giant": {
  "cr": 9,
  "ac": 18,
  "hp": 162,
  "hp_roll": "13d12+78",
  "str": 25,
  "dex": 9,
  "con": 23,
  "int": 10,
  "wis": 14,
  "cha": 13,
  "speed": 30,
  "save_prof": [
   "dex",
   "con",
   "cha"
  ],
  "skill_prof": [
   "athletics",
   "perception"
  ],
  "languages": [
   "Giant"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Huge giant, CR 9 (5000 XP)"
 },
 "flesh-golem": {
  "cr": 5,
  "ac": 9,
  "hp": 93,
  "hp_roll": "11d8+44",
  "str": 19,
  "dex": 9,
  "con": 18,
  "int": 6,
  "wis": 10,
  "cha": 5,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "understands the languages of its creator but can't speak"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing",
   "poison",
   "lightning"
  ],
  "vuln": [],
  "description": "Medium construct, CR 5 (1800 XP)",
  "features": [
   "Berserk|Whenever the golem starts its turn with 40 hit points or fewer, roll a d6. On a 6, the golem goes berserk. On each of its turns while berserk, the golem attacks the nearest creature it can see. If no creature is near enough to move to and attack, the golem attacks an object, with preference for an object smaller than itself. Once the golem goes berserk, it continues to do so until it is destroyed or regains all its hit points.",
   "Aversion of Fire|If the golem takes fire damage, it has disadvantage on attack rolls and ability checks until the end of its next turn.",
   "Immutable Form|The golem is immune to any spell or effect that would alter its form.",
   "Lightning Absorption|Whenever the golem is subjected to lightning damage, it takes no damage and instead regains a number of hit points equal to the lightning damage dealt.",
   "Magic Resistance|The golem has advantage on saving throws against spells and other magical effects.",
   "Magic Weapons|The golem's weapon attacks are magical."
  ]
 },
 "flying-snake": {
  "cr": 0.125,
  "ac": 14,
  "hp": 5,
  "hp_roll": "2d4",
  "str": 4,
  "dex": 18,
  "con": 11,
  "int": 2,
  "wis": 12,
  "cha": 5,
  "speed": 30,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0.125 (25 XP)",
  "features": [
   "Flyby|The snake doesn't provoke opportunity attacks when it flies out of an enemy's reach."
  ]
 },
 "flying-sword": {
  "cr": 0.25,
  "ac": 17,
  "hp": 17,
  "hp_roll": "5d6",
  "str": 12,
  "dex": 15,
  "con": 11,
  "int": 1,
  "wis": 5,
  "cha": 1,
  "speed": 0,
  "save_prof": [
   "dex"
  ],
  "resist": [],
  "immune": [
   "poison",
   "psychic"
  ],
  "vuln": [],
  "description": "Small construct, CR 0.25 (50 XP)",
  "features": [
   "Antimagic Susceptibility|The sword is incapacitated while in the area of an antimagic field. If targeted by dispel magic, the sword must succeed on a Constitution saving throw against the caster's spell save DC or fall unconscious for 1 minute.",
   "False Appearance|While the sword remains motionless and isn't flying, it is indistinguishable from a normal sword."
  ]
 },
 "frog": {
  "cr": 0,
  "ac": 11,
  "hp": 1,
  "hp_roll": "1d4-1",
  "str": 1,
  "dex": 13,
  "con": 8,
  "int": 1,
  "wis": 8,
  "cha": 3,
  "speed": 20,
  "darkvision": 30,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0 (0 XP)",
  "features": [
   "Amphibious|The frog can breathe air and water",
   "Standing Leap|The frog's long jump is up to 10 ft. and its high jump is up to 5 ft., with or without a running start."
  ]
 },
 "frost-giant": {
  "cr": 8,
  "ac": 15,
  "hp": 138,
  "hp_roll": "12d12+60",
  "str": 23,
  "dex": 9,
  "con": 21,
  "int": 9,
  "wis": 10,
  "cha": 12,
  "speed": 40,
  "save_prof": [
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "athletics",
   "perception"
  ],
  "languages": [
   "Giant"
  ],
  "resist": [],
  "immune": [
   "cold"
  ],
  "vuln": [],
  "description": "Huge giant, CR 8 (3900 XP)"
 },
 "gargoyle": {
  "cr": 2,
  "ac": 15,
  "hp": 52,
  "hp_roll": "7d8+21",
  "str": 15,
  "dex": 11,
  "con": 16,
  "int": 6,
  "wis": 11,
  "cha": 7,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "Terran"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Medium elemental, CR 2 (450 XP)",
  "features": [
   "False Appearance|While the gargoyle remains motion less, it is indistinguishable from an inanimate statue."
  ]
 },
 "gelatinous-cube": {
  "cr": 2,
  "ac": 6,
  "hp": 84,
  "hp_roll": "8d10+40",
  "str": 14,
  "dex": 3,
  "con": 20,
  "int": 1,
  "wis": 6,
  "cha": 1,
  "speed": 15,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large ooze, CR 2 (450 XP)",
  "features": [
   "Ooze Cube|The cube takes up its entire space. Other creatures can enter the space, but a creature that does so is subjected to the cube's Engulf and has disadvantage on the saving throw.",
   "Transparent|Even when the cube is in plain sight, it takes a successful DC 15 Wisdom (Perception) check to spot a cube that has neither moved nor attacked. A creature that tries to enter the cube's space while unaware of the cube is surprised by the cube."
  ]
 },
 "ghast": {
  "cr": 2,
  "ac": 13,
  "hp": 36,
  "hp_roll": "8d8",
  "str": 16,
  "dex": 17,
  "con": 10,
  "int": 11,
  "wis": 10,
  "cha": 8,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "Common"
  ],
  "resist": [
   "necrotic"
  ],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Medium undead, CR 2 (450 XP)",
  "features": [
   "Stench|Any creature that starts its turn within 5 ft. of the ghast must succeed on a DC 10 Constitution saving throw or be poisoned until the start of its next turn. On a successful saving throw, the creature is immune to the ghast's Stench for 24 hours.",
   "Turn Defiance|The ghast and any ghouls within 30 ft. of it have advantage on saving throws against effects that turn undead."
  ]
 },
 "ghost": {
  "cr": 4,
  "ac": 11,
  "hp": 45,
  "hp_roll": "10d8",
  "str": 7,
  "dex": 13,
  "con": 10,
  "int": 10,
  "wis": 12,
  "cha": 17,
  "speed": 0,
  "darkvision": 60,
  "languages": [
   "any languages it knew in life"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "fire",
   "acid",
   "lightning",
   "thunder"
  ],
  "immune": [
   "cold",
   "poison",
   "necrotic"
  ],
  "vuln": [],
  "description": "Medium undead, CR 4 (1100 XP)",
  "features": [
   "Ethereal Sight|The ghost can see 60 ft. into the Ethereal Plane when it is on the Material Plane, and vice versa.",
   "Incorporeal Movement|The ghost can move through other creatures and objects as if they were difficult terrain. It takes 5 (1d10) force damage if it ends its turn inside an object."
  ]
 },
 "ghoul": {
  "cr": 1,
  "ac": 12,
  "hp": 22,
  "hp_roll": "5d8",
  "str": 13,
  "dex": 15,
  "con": 10,
  "int": 7,
  "wis": 10,
  "cha": 6,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "Common"
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Medium undead, CR 1 (200 XP)"
 },
 "giant-ape": {
  "cr": 7,
  "ac": 12,
  "hp": 157,
  "hp_roll": "15d12+60",
  "str": 23,
  "dex": 14,
  "con": 18,
  "int": 7,
  "wis": 12,
  "cha": 7,
  "speed": 40,
  "skill_prof": [
   "athletics",
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Huge beast, CR 7 (2900 XP)"
 },
 "giant-badger": {
  "cr": 0.25,
  "ac": 10,
  "hp": 13,
  "hp_roll": "2d8+4",
  "str": 13,
  "dex": 10,
  "con": 15,
  "int": 2,
  "wis": 12,
  "cha": 5,
  "speed": 30,
  "darkvision": 30,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.25 (50 XP)",
  "features": [
   "Keen Smell|The badger has advantage on Wisdom (Perception) checks that rely on smell."
  ]
 },
 "giant-bat": {
  "cr": 0.25,
  "ac": 13,
  "hp": 22,
  "hp_roll": "4d10",
  "str": 15,
  "dex": 16,
  "con": 11,
  "int": 2,
  "wis": 12,
  "cha": 6,
  "speed": 10,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 0.25 (50 XP)",
  "features": [
   "Echolocation|The bat can't use its blindsight while deafened.",
   "Keen Hearing|The bat has advantage on Wisdom (Perception) checks that rely on hearing."
  ]
 },
 "giant-boar": {
  "cr": 2,
  "ac": 12,
  "hp": 42,
  "hp_roll": "5d10+15",
  "str": 17,
  "dex": 10,
  "con": 16,
  "int": 2,
  "wis": 7,
  "cha": 5,
  "speed": 40,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 2 (450 XP)",
  "features": [
   "Charge|If the boar moves at least 20 ft. straight toward a target and then hits it with a tusk attack on the same turn, the target takes an extra 7 (2d6) slashing damage. If the target is a creature, it must succeed on a DC 13 Strength saving throw or be knocked prone.",
   "Relentless|If the boar takes 10 damage or less that would reduce it to 0 hit points, it is reduced to 1 hit point instead."
  ]
 },
 "giant-centipede": {
  "cr": 0.25,
  "ac": 13,
  "hp": 4,
  "hp_roll": "1d6+1",
  "str": 5,
  "dex": 14,
  "con": 12,
  "int": 1,
  "wis": 7,
  "cha": 3,
  "speed": 30,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Small beast, CR 0.25 (50 XP)"
 },
 "giant-constrictor-snake": {
  "cr": 2,
  "ac": 12,
  "hp": 60,
  "hp_roll": "8d12+8",
  "str": 19,
  "dex": 14,
  "con": 12,
  "int": 1,
  "wis": 10,
  "cha": 3,
  "speed": 30,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Huge beast, CR 2 (450 XP)"
 },
 "giant-crab": {
  "cr": 0.125,
  "ac": 15,
  "hp": 13,
  "hp_roll": "3d8",
  "str": 13,
  "dex": 15,
  "con": 11,
  "int": 1,
  "wis": 9,
  "cha": 3,
  "speed": 30,
  "skill_prof": [
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.125 (25 XP)",
  "features": [
   "Amphibious|The crab can breathe air and water."
  ]
 },
 "giant-crocodile": {
  "cr": 5,
  "ac": 14,
  "hp": 85,
  "hp_roll": "9d12+27",
  "str": 21,
  "dex": 9,
  "con": 17,
  "int": 2,
  "wis": 10,
  "cha": 7,
  "speed": 30,
  "skill_prof": [
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Huge beast, CR 5 (1800 XP)",
  "features": [
   "Hold Breath|The crocodile can hold its breath for 30 minutes."
  ]
 },
 "giant-eagle": {
  "cr": 1,
  "ac": 13,
  "hp": 26,
  "hp_roll": "4d10+4",
  "str": 16,
  "dex": 17,
  "con": 13,
  "int": 8,
  "wis": 14,
  "cha": 10,
  "speed": 10,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "Giant Eagle",
   "understands Common and Auran but can't speak"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 1 (200 XP)",
  "features": [
   "Keen Sight|The eagle has advantage on Wisdom (Perception) checks that rely on sight."
  ]
 },
 "giant-elk": {
  "cr": 2,
  "ac": 14,
  "hp": 42,
  "hp_roll": "5d12+10",
  "str": 19,
  "dex": 16,
  "con": 14,
  "int": 7,
  "wis": 14,
  "cha": 10,
  "speed": 60,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "Giant Elk",
   "understands Common",
   "Elvish",
   "and Sylvan but can't speak"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Huge beast, CR 2 (450 XP)",
  "features": [
   "Charge|If the elk moves at least 20 ft. straight toward a target and then hits it with a ram attack on the same turn, the target takes an extra 7 (2d6) damage. If the target is a creature, it must succeed on a DC 14 Strength saving throw or be knocked prone."
  ]
 },
 "giant-fire-beetle": {
  "cr": 0,
  "ac": 13,
  "hp": 4,
  "hp_roll": "1d6+1",
  "str": 8,
  "dex": 10,
  "con": 12,
  "int": 1,
  "wis": 7,
  "cha": 3,
  "speed": 30,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Small beast, CR 0 (10 XP)",
  "features": [
   "Illumination|The beetle sheds bright light in a 10-foot radius and dim light for an additional 10 ft.."
  ]
 },
 "giant-frog": {
  "cr": 0.25,
  "ac": 11,
  "hp": 18,
  "hp_roll": "4d8",
  "str": 12,
  "dex": 13,
  "con": 11,
  "int": 2,
  "wis": 10,
  "cha": 3,
  "speed": 30,
  "darkvision": 30,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.25 (50 XP)",
  "features": [
   "Amphibious|The frog can breathe air and water",
   "Standing Leap|The frog's long jump is up to 20 ft. and its high jump is up to 10 ft., with or without a running start."
  ]
 },
 "giant-goat": {
  "cr": 0.5,
  "ac": 11,
  "hp": 19,
  "hp_roll": "3d10+3",
  "str": 17,
  "dex": 11,
  "con": 12,
  "int": 3,
  "wis": 12,
  "cha": 6,
  "speed": 40,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 0.5 (100 XP)",
  "features": [
   "Charge|If the goat moves at least 20 ft. straight toward a target and then hits it with a ram attack on the same turn, the target takes an extra 5 (2d4) bludgeoning damage. If the target is a creature, it must succeed on a DC 13 Strength saving throw or be knocked prone.",
   "Sure-Footed|The goat has advantage on Strength and Dexterity saving throws made against effects that would knock it prone."
  ]
 },
 "giant-hyena": {
  "cr": 1,
  "ac": 12,
  "hp": 45,
  "hp_roll": "6d10+12",
  "str": 16,
  "dex": 14,
  "con": 14,
  "int": 2,
  "wis": 12,
  "cha": 7,
  "speed": 50,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 1 (200 XP)",
  "features": [
   "Rampage|When the hyena reduces a creature to 0 hit points with a melee attack on its turn, the hyena can take a bonus action to move up to half its speed and make a bite attack."
  ]
 },
 "giant-lizard": {
  "cr": 0.25,
  "ac": 12,
  "hp": 19,
  "hp_roll": "3d10+3",
  "str": 15,
  "dex": 12,
  "con": 13,
  "int": 2,
  "wis": 10,
  "cha": 5,
  "speed": 30,
  "darkvision": 30,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 0.25 (50 XP)"
 },
 "giant-octopus": {
  "cr": 1,
  "ac": 11,
  "hp": 52,
  "hp_roll": "8d10+8",
  "str": 17,
  "dex": 13,
  "con": 13,
  "int": 4,
  "wis": 10,
  "cha": 4,
  "speed": 10,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 1 (200 XP)",
  "features": [
   "Hold Breath|While out of water, the octopus can hold its breath for 1 hour.",
   "Underwater Camouflage|The octopus has advantage on Dexterity (Stealth) checks made while underwater.",
   "Water Breathing|The octopus can breathe only underwater."
  ]
 },
 "giant-owl": {
  "cr": 0.25,
  "ac": 12,
  "hp": 19,
  "hp_roll": "3d10+3",
  "str": 13,
  "dex": 15,
  "con": 12,
  "int": 8,
  "wis": 13,
  "cha": 10,
  "speed": 5,
  "darkvision": 120,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Giant Owl",
   "understands Common",
   "Elvish",
   "and Sylvan but can't speak"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 0.25 (50 XP)",
  "features": [
   "Flyby|The owl doesn't provoke opportunity attacks when it flies out of an enemy's reach.",
   "Keen Hearing and Sight|The owl has advantage on Wisdom (Perception) checks that rely on hearing or sight."
  ]
 },
 "giant-poisonous-snake": {
  "cr": 0.25,
  "ac": 14,
  "hp": 11,
  "hp_roll": "2d8+2",
  "str": 10,
  "dex": 18,
  "con": 13,
  "int": 2,
  "wis": 10,
  "cha": 3,
  "speed": 30,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.25 (50 XP)"
 },
 "giant-rat": {
  "cr": 0.125,
  "ac": 12,
  "hp": 7,
  "hp_roll": "2d6",
  "str": 7,
  "dex": 15,
  "con": 11,
  "int": 2,
  "wis": 10,
  "cha": 4,
  "speed": 30,
  "darkvision": 60,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Small beast, CR 0.125 (25 XP)",
  "features": [
   "Keen Smell|The rat has advantage on Wisdom (Perception) checks that rely on smell.",
   "Pack Tactics|The rat has advantage on an attack roll against a creature if at least one of the rat's allies is within 5 ft. of the creature and the ally isn't incapacitated."
  ]
 },
 "giant-rat-diseased": {
  "cr": 0.125,
  "ac": 12,
  "hp": 7,
  "hp_roll": "2d6",
  "str": 7,
  "dex": 15,
  "con": 11,
  "int": 2,
  "wis": 10,
  "cha": 4,
  "speed": 30,
  "darkvision": 60,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Small beast, CR 0.125 (25 XP)",
  "features": [
   "Keen Smell|The rat has advantage on Wisdom (Perception) checks that rely on smell.",
   "Pack Tactics|The rat has advantage on an attack roll against a creature if at least one of the rat's allies is within 5 ft. of the creature and the ally isn't incapacitated."
  ]
 },
 "giant-scorpion": {
  "cr": 3,
  "ac": 15,
  "hp": 52,
  "hp_roll": "7d10+14",
  "str": 15,
  "dex": 13,
  "con": 15,
  "int": 1,
  "wis": 9,
  "cha": 3,
  "speed": 40,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 3 (700 XP)"
 },
 "giant-sea-horse": {
  "cr": 0.5,
  "ac": 13,
  "hp": 16,
  "hp_roll": "3d10",
  "str": 12,
  "dex": 15,
  "con": 11,
  "int": 2,
  "wis": 12,
  "cha": 5,
  "speed": 0,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 0.5 (100 XP)",
  "features": [
   "Charge|If the sea horse moves at least 20 ft. straight toward a target and then hits it with a ram attack on the same turn, the target takes an extra 7 (2d6) bludgeoning damage. If the target is a creature, it must succeed on a DC 11 Strength saving throw or be knocked prone.",
   "Water Breathing|The sea horse can breathe only underwater."
  ]
 },
 "giant-shark": {
  "cr": 5,
  "ac": 13,
  "hp": 126,
  "hp_roll": "11d12+55",
  "str": 23,
  "dex": 11,
  "con": 21,
  "int": 1,
  "wis": 10,
  "cha": 5,
  "speed": 30,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Huge beast, CR 5 (1800 XP)",
  "features": [
   "Blood Frenzy|The shark has advantage on melee attack rolls against any creature that doesn't have all its hit points.",
   "Water Breathing|The shark can breathe only underwater."
  ]
 },
 "giant-spider": {
  "cr": 1,
  "ac": 14,
  "hp": 26,
  "hp_roll": "4d10+4",
  "str": 14,
  "dex": 16,
  "con": 12,
  "int": 2,
  "wis": 11,
  "cha": 4,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 1 (200 XP)",
  "features": [
   "Spider Climb|The spider can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.",
   "Web Sense|While in contact with a web, the spider knows the exact location of any other creature in contact with the same web.",
   "Web Walker|The spider ignores movement restrictions caused by webbing."
  ]
 },
 "giant-toad": {
  "cr": 1,
  "ac": 11,
  "hp": 39,
  "hp_roll": "6d10+6",
  "str": 15,
  "dex": 13,
  "con": 13,
  "int": 2,
  "wis": 10,
  "cha": 3,
  "speed": 20,
  "darkvision": 30,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 1 (200 XP)",
  "features": [
   "Amphibious|The toad can breathe air and water",
   "Standing Leap|The toad's long jump is up to 20 ft. and its high jump is up to 10 ft., with or without a running start."
  ]
 },
 "giant-vulture": {
  "cr": 1,
  "ac": 10,
  "hp": 22,
  "hp_roll": "3d10+6",
  "str": 15,
  "dex": 10,
  "con": 15,
  "int": 6,
  "wis": 12,
  "cha": 7,
  "speed": 10,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "understands Common but can't speak"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 1 (200 XP)",
  "features": [
   "Keen Sight and Smell|The vulture has advantage on Wisdom (Perception) checks that rely on sight or smell.",
   "Pack Tactics|The vulture has advantage on an attack roll against a creature if at least one of the vulture's allies is within 5 ft. of the creature and the ally isn't incapacitated."
  ]
 },
 "giant-wasp": {
  "cr": 0.5,
  "ac": 12,
  "hp": 13,
  "hp_roll": "3d8",
  "str": 10,
  "dex": 14,
  "con": 10,
  "int": 1,
  "wis": 10,
  "cha": 3,
  "speed": 10,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.5 (100 XP)"
 },
 "giant-weasel": {
  "cr": 0.125,
  "ac": 13,
  "hp": 9,
  "hp_roll": "2d8",
  "str": 11,
  "dex": 16,
  "con": 10,
  "int": 4,
  "wis": 12,
  "cha": 5,
  "speed": 40,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.125 (25 XP)",
  "features": [
   "Keen Hearing and Smell|The weasel has advantage on Wisdom (Perception) checks that rely on hearing or smell."
  ]
 },
 "giant-wolf-spider": {
  "cr": 0.25,
  "ac": 13,
  "hp": 11,
  "hp_roll": "2d8+2",
  "str": 12,
  "dex": 16,
  "con": 13,
  "int": 3,
  "wis": 12,
  "cha": 4,
  "speed": 40,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.25 (50 XP)",
  "features": [
   "Spider Climb|The spider can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.",
   "Web Sense|While in contact with a web, the spider knows the exact location of any other creature in contact with the same web.",
   "Web Walker|The spider ignores movement restrictions caused by webbing."
  ]
 },
 "gibbering-mouther": {
  "cr": 2,
  "ac": 9,
  "hp": 67,
  "hp_roll": "9d8+27",
  "str": 10,
  "dex": 8,
  "con": 16,
  "int": 3,
  "wis": 10,
  "cha": 6,
  "speed": 10,
  "darkvision": 60,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium aberration, CR 2 (450 XP)",
  "features": [
   "Aberrant Ground|The ground in a 10-foot radius around the mouther is doughlike difficult terrain. Each creature that starts its turn in that area must succeed on a DC 10 Strength saving throw or have its speed reduced to 0 until the start of its next turn.",
   "Gibbering|The mouther babbles incoherently while it can see any creature and isn't incapacitated. Each creature that starts its turn within 20 feet of the mouther and can hear the gibbering must succeed on a DC 10 Wisdom saving throw. On a failure, the creature can't take reactions until the start of its next turn and rolls a d8 to determine what it does during its turn. On a 1 to 4, the creature does nothing. On a 5 or 6, the creature takes no action or bonus action and uses all its movement to move in a randomly determined direction. On a 7 or 8, the creature makes a melee attack against a randomly determined creature within its reach or does nothing if it can't make such an attack."
  ]
 },
 "glabrezu": {
  "cr": 9,
  "ac": 17,
  "hp": 157,
  "hp_roll": "15d10+75",
  "str": 20,
  "dex": 15,
  "con": 21,
  "int": 19,
  "wis": 17,
  "cha": 16,
  "speed": 40,
  "save_prof": [
   "str",
   "con",
   "wis",
   "cha"
  ],
  "languages": [
   "Abyssal",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "fire",
   "cold",
   "lightning"
  ],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Large fiend, CR 9 (5000 XP)",
  "features": [
   "Innate Spellcasting|The glabrezu's spellcasting ability is Intelligence (spell save DC 16). The glabrezu can innately cast the following spells, requiring no material components:",
   "Magic Resistance|The glabrezu has advantage on saving throws against spells and other magical effects."
  ]
 },
 "gladiator": {
  "cr": 5,
  "ac": 16,
  "hp": 112,
  "hp_roll": "15d8+45",
  "str": 18,
  "dex": 15,
  "con": 16,
  "int": 10,
  "wis": 12,
  "cha": 15,
  "speed": 30,
  "save_prof": [
   "str",
   "dex",
   "con"
  ],
  "skill_prof": [
   "athletics",
   "intimidation"
  ],
  "languages": [
   "any one language (usually Common)"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 5 (1800 XP)",
  "features": [
   "Brave|The gladiator has advantage on saving throws against being frightened.",
   "Brute|A melee weapon deals one extra die of its damage when the gladiator hits with it (included in the attack)."
  ]
 },
 "gnoll": {
  "cr": 0.5,
  "ac": 15,
  "hp": 22,
  "hp_roll": "5d8",
  "str": 14,
  "dex": 12,
  "con": 11,
  "int": 6,
  "wis": 10,
  "cha": 7,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "Gnoll"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.5 (100 XP)",
  "features": [
   "Rampage|When the gnoll reduces a creature to 0 hit points with a melee attack on its turn, the gnoll can take a bonus action to move up to half its speed and make a bite attack."
  ]
 },
 "goat": {
  "cr": 0,
  "ac": 10,
  "hp": 4,
  "hp_roll": "1d8",
  "str": 12,
  "dex": 10,
  "con": 11,
  "int": 2,
  "wis": 10,
  "cha": 5,
  "speed": 40,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0 (10 XP)",
  "features": [
   "Charge|If the goat moves at least 20 ft. straight toward a target and then hits it with a ram attack on the same turn, the target takes an extra 2 (1d4) bludgeoning damage. If the target is a creature, it must succeed on a DC 10 Strength saving throw or be knocked prone.",
   "Sure-Footed|The goat has advantage on Strength and Dexterity saving throws made against effects that would knock it prone."
  ]
 },
 "goblin": {
  "cr": 0.25,
  "ac": 15,
  "hp": 7,
  "hp_roll": "2d6",
  "str": 8,
  "dex": 14,
  "con": 10,
  "int": 10,
  "wis": 8,
  "cha": 8,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "stealth"
  ],
  "languages": [
   "Common",
   "Goblin"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Small humanoid, CR 0.25 (50 XP)",
  "features": [
   "Nimble Escape|The goblin can take the Disengage or Hide action as a bonus action on each of its turns."
  ]
 },
 "gold-dragon-wyrmling": {
  "cr": 3,
  "ac": 17,
  "hp": 60,
  "hp_roll": "8d8+24",
  "str": 19,
  "dex": 14,
  "con": 17,
  "int": 14,
  "wis": 11,
  "cha": 16,
  "speed": 30,
  "darkvision": 60,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Medium dragon, CR 3 (700 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water."
  ]
 },
 "gorgon": {
  "cr": 5,
  "ac": 19,
  "hp": 114,
  "hp_roll": "12d10+48",
  "str": 20,
  "dex": 11,
  "con": 18,
  "int": 2,
  "wis": 12,
  "cha": 7,
  "speed": 40,
  "darkvision": 60,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 5 (1800 XP)",
  "features": [
   "Trampling Charge|If the gorgon moves at least 20 feet straight toward a creature and then hits it with a gore attack on the same turn, that target must succeed on a DC 16 Strength saving throw or be knocked prone. If the target is prone, the gorgon can make one attack with its hooves against it as a bonus action."
  ]
 },
 "gray-ooze": {
  "cr": 0.5,
  "ac": 8,
  "hp": 22,
  "hp_roll": "3d8+9",
  "str": 12,
  "dex": 6,
  "con": 16,
  "int": 1,
  "wis": 6,
  "cha": 2,
  "speed": 10,
  "skill_prof": [
   "stealth"
  ],
  "resist": [
   "fire",
   "cold",
   "acid"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium ooze, CR 0.5 (100 XP)",
  "features": [
   "Amorphous|The ooze can move through a space as narrow as 1 inch wide without squeezing.",
   "Corrode Metal|Any nonmagical weapon made of metal that hits the ooze corrodes. After dealing damage, the weapon takes a permanent and cumulative -1 penalty to damage rolls. If its penalty drops to -5, the weapon is destroyed. Nonmagical ammunition made of metal that hits the ooze is destroyed after dealing damage.",
   "False Appearance|While the ooze remains motionless, it is indistinguishable from an oily pool or wet rock."
  ]
 },
 "green-dragon-wyrmling": {
  "cr": 2,
  "ac": 17,
  "hp": 38,
  "hp_roll": "7d8+7",
  "str": 15,
  "dex": 12,
  "con": 13,
  "int": 14,
  "wis": 11,
  "cha": 13,
  "speed": 30,
  "darkvision": 60,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Medium dragon, CR 2 (450 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water."
  ]
 },
 "green-hag": {
  "cr": 3,
  "ac": 17,
  "hp": 82,
  "hp_roll": "11d8+33",
  "str": 18,
  "dex": 12,
  "con": 16,
  "int": 13,
  "wis": 14,
  "cha": 14,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "arcana",
   "deception",
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic",
   "Sylvan"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium fey, CR 3 (700 XP)",
  "features": [
   "Amphibious|The hag can breathe air and water.",
   "Innate Spellcasting|The hag's innate spellcasting ability is Charisma (spell save DC 12). She can innately cast the following spells, requiring no material components:",
   "Mimicry|The hag can mimic animal sounds and humanoid voices. A creature that hears the sounds can tell they are imitations with a successful DC 14 Wisdom (Insight) check."
  ]
 },
 "grick": {
  "cr": 2,
  "ac": 14,
  "hp": 27,
  "hp_roll": "6d8",
  "str": 14,
  "dex": 14,
  "con": 11,
  "int": 3,
  "wis": 14,
  "cha": 5,
  "speed": 30,
  "darkvision": 60,
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium monstrosity, CR 2 (450 XP)",
  "features": [
   "Stone Camouflage|The grick has advantage on Dexterity (Stealth) checks made to hide in rocky terrain."
  ]
 },
 "griffon": {
  "cr": 2,
  "ac": 12,
  "hp": 59,
  "hp_roll": "7d10+21",
  "str": 18,
  "dex": 15,
  "con": 16,
  "int": 2,
  "wis": 13,
  "cha": 8,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 2 (450 XP)",
  "features": [
   "Keen Sight|The griffon has advantage on Wisdom (Perception) checks that rely on sight."
  ]
 },
 "grimlock": {
  "cr": 0.25,
  "ac": 11,
  "hp": 11,
  "hp_roll": "2d8+2",
  "str": 16,
  "dex": 12,
  "con": 12,
  "int": 9,
  "wis": 8,
  "cha": 6,
  "speed": 30,
  "skill_prof": [
   "athletics",
   "perception",
   "stealth"
  ],
  "languages": [
   "Undercommon"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.25 (50 XP)",
  "features": [
   "Blind Senses|The grimlock can't use its blindsight while deafened and unable to smell.",
   "Keen Hearing and Smell|The grimlock has advantage on Wisdom (Perception) checks that rely on hearing or smell.",
   "Stone Camouflage|The grimlock has advantage on Dexterity (Stealth) checks made to hide in rocky terrain."
  ]
 },
 "guard": {
  "cr": 0.125,
  "ac": 16,
  "hp": 11,
  "hp_roll": "2d8+2",
  "str": 13,
  "dex": 12,
  "con": 12,
  "int": 10,
  "wis": 11,
  "cha": 10,
  "speed": 30,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "any one language (usually Common)"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.125 (25 XP)"
 },
 "guardian-naga": {
  "cr": 10,
  "ac": 18,
  "hp": 127,
  "hp_roll": "15d10+45",
  "str": 19,
  "dex": 18,
  "con": 16,
  "int": 16,
  "wis": 19,
  "cha": 18,
  "speed": 40,
  "darkvision": 60,
  "save_prof": [
   "dex",
   "con",
   "int",
   "wis",
   "cha"
  ],
  "languages": [
   "Celestial",
   "Common"
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Large monstrosity, CR 10 (5900 XP)",
  "features": [
   "Rejuvenation|If it dies, the naga returns to life in 1d6 days and regains all its hit points. Only a wish spell can prevent this trait from functioning.",
   "Spellcasting|The naga is an 11th-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 16, +8 to hit with spell attacks), and it needs only verbal components to cast its spells. It has the following cleric spells prepared:"
  ]
 },
 "gynosphinx": {
  "cr": 11,
  "ac": 17,
  "hp": 136,
  "hp_roll": "16d10+48",
  "str": 18,
  "dex": 15,
  "con": 16,
  "int": 18,
  "wis": 18,
  "cha": 18,
  "speed": 40,
  "skill_prof": [
   "arcana",
   "history",
   "perception",
   "religion"
  ],
  "languages": [
   "Common",
   "Sphinx"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [
   "psychic"
  ],
  "vuln": [],
  "description": "Large monstrosity, CR 11 (7200 XP)",
  "features": [
   "Inscrutable|The sphinx is immune to any effect that would sense its emotions or read its thoughts, as well as any divination spell that it refuses. Wisdom (Insight) checks made to ascertain the sphinx's intentions or sincerity have disadvantage.",
   "Magic Weapons|The sphinx's weapon attacks are magical.",
   "Spellcasting|The sphinx is a 9th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 16, +8 to hit with spell attacks). It requires no material components to cast its spells. The sphinx has the following wizard spells prepared:"
  ]
 },
 "half-red-dragon-veteran": {
  "cr": 5,
  "ac": 18,
  "hp": 65,
  "hp_roll": "10d8+20",
  "str": 16,
  "dex": 13,
  "con": 14,
  "int": 10,
  "wis": 11,
  "cha": 10,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [
   "fire"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 5 (1800 XP)"
 },
 "harpy": {
  "cr": 1,
  "ac": 11,
  "hp": 38,
  "hp_roll": "7d8+7",
  "str": 12,
  "dex": 13,
  "con": 12,
  "int": 7,
  "wis": 10,
  "cha": 13,
  "speed": 20,
  "languages": [
   "Common"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium monstrosity, CR 1 (200 XP)"
 },
 "hawk": {
  "cr": 0,
  "ac": 13,
  "hp": 1,
  "hp_roll": "1d4-1",
  "str": 5,
  "dex": 16,
  "con": 8,
  "int": 2,
  "wis": 14,
  "cha": 6,
  "speed": 10,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0 (10 XP)",
  "features": [
   "Keen Sight|The hawk has advantage on Wisdom (Perception) checks that rely on sight."
  ]
 },
 "hell-hound": {
  "cr": 3,
  "ac": 15,
  "hp": 45,
  "hp_roll": "7d8+14",
  "str": 17,
  "dex": 12,
  "con": 14,
  "int": 6,
  "wis": 13,
  "cha": 6,
  "speed": 50,
  "darkvision": 60,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "understands Infernal but can't speak it"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Medium fiend, CR 3 (700 XP)",
  "features": [
   "Keen Hearing and Smell|The hound has advantage on Wisdom (Perception) checks that rely on hearing or smell.",
   "Pack Tactics|The hound has advantage on an attack roll against a creature if at least one of the hound's allies is within 5 ft. of the creature and the ally isn't incapacitated."
  ]
 },
 "hezrou": {
  "cr": 8,
  "ac": 16,
  "hp": 136,
  "hp_roll": "13d10+65",
  "str": 19,
  "dex": 17,
  "con": 20,
  "int": 5,
  "wis": 12,
  "cha": 13,
  "speed": 30,
  "darkvision": 120,
  "save_prof": [
   "str",
   "con",
   "wis"
  ],
  "languages": [
   "Abyssal",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "fire",
   "cold",
   "lightning"
  ],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Large fiend, CR 8 (3900 XP)",
  "features": [
   "Magic Resistance|The hezrou has advantage on saving throws against spells and other magical effects.",
   "Stench|Any creature that starts its turn within 10 feet of the hezrou must succeed on a DC 14 Constitution saving throw or be poisoned until the start of its next turn. On a successful saving throw, the creature is immune to the hezrou's stench for 24 hours."
  ]
 },
 "hill-giant": {
  "cr": 5,
  "ac": 13,
  "hp": 105,
  "hp_roll": "10d12+40",
  "str": 21,
  "dex": 8,
  "con": 19,
  "int": 5,
  "wis": 9,
  "cha": 6,
  "speed": 40,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "Giant"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Huge giant, CR 5 (1800 XP)"
 },
 "hippogriff": {
  "cr": 1,
  "ac": 11,
  "hp": 19,
  "hp_roll": "3d10+3",
  "str": 17,
  "dex": 13,
  "con": 13,
  "int": 2,
  "wis": 12,
  "cha": 8,
  "speed": 40,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 1 (200 XP)",
  "features": [
   "Keen Sight|The hippogriff has advantage on Wisdom (Perception) checks that rely on sight."
  ]
 },
 "hobgoblin": {
  "cr": 0.5,
  "ac": 18,
  "hp": 11,
  "hp_roll": "2d8+2",
  "str": 13,
  "dex": 12,
  "con": 12,
  "int": 10,
  "wis": 10,
  "cha": 9,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "Common",
   "Goblin"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.5 (100 XP)",
  "features": [
   "Martial Advantage|Once per turn, the hobgoblin can deal an extra 7 (2d6) damage to a creature it hits with a weapon attack if that creature is within 5 ft. of an ally of the hobgoblin that isn't incapacitated."
  ]
 },
 "homunculus": {
  "cr": 0,
  "ac": 13,
  "hp": 5,
  "hp_roll": "2d4",
  "str": 4,
  "dex": 15,
  "con": 11,
  "int": 10,
  "wis": 10,
  "cha": 7,
  "speed": 20,
  "darkvision": 60,
  "languages": [
   "understands the languages of its creator but can't speak"
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Tiny construct, CR 0 (10 XP)",
  "features": [
   "Telepathic Bond|While the homunculus is on the same plane of existence as its master, it can magically convey what it senses to its master, and the two can communicate telepathically."
  ]
 },
 "horned-devil": {
  "cr": 11,
  "ac": 18,
  "hp": 178,
  "hp_roll": "17d10+85",
  "str": 22,
  "dex": 17,
  "con": 21,
  "int": 12,
  "wis": 16,
  "cha": 17,
  "speed": 20,
  "darkvision": 120,
  "save_prof": [
   "str",
   "dex",
   "wis",
   "cha"
  ],
  "languages": [
   "Infernal",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "cold"
  ],
  "immune": [
   "fire",
   "poison"
  ],
  "vuln": [],
  "description": "Large fiend, CR 11 (7200 XP)",
  "features": [
   "Devil's Sight|Magical darkness doesn't impede the devil's darkvision.",
   "Magic Resistance|The devil has advantage on saving throws against spells and other magical effects."
  ]
 },
 "hunter-shark": {
  "cr": 2,
  "ac": 12,
  "hp": 45,
  "hp_roll": "6d10+12",
  "str": 18,
  "dex": 13,
  "con": 15,
  "int": 1,
  "wis": 10,
  "cha": 4,
  "speed": 30,
  "darkvision": 30,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 2 (450 XP)",
  "features": [
   "Blood Frenzy|The shark has advantage on melee attack rolls against any creature that doesn't have all its hit points.",
   "Water Breathing|The shark can breathe only underwater."
  ]
 },
 "hydra": {
  "cr": 8,
  "ac": 15,
  "hp": 172,
  "hp_roll": "15d12+75",
  "str": 20,
  "dex": 12,
  "con": 20,
  "int": 2,
  "wis": 10,
  "cha": 7,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Huge monstrosity, CR 8 (3900 XP)",
  "features": [
   "Hold Breath|The hydra can hold its breath for 1 hour.",
   "Multiple Heads|The hydra has five heads. While it has more than one head, the hydra has advantage on saving throws against being blinded, charmed, deafened, frightened, stunned, and knocked unconscious.",
   "Reactive Heads|For each head the hydra has beyond one, it gets an extra reaction that can be used only for opportunity attacks.",
   "Wakeful|While the hydra sleeps, at least one of its heads is awake."
  ]
 },
 "hyena": {
  "cr": 0,
  "ac": 11,
  "hp": 5,
  "hp_roll": "1d8+1",
  "str": 11,
  "dex": 13,
  "con": 12,
  "int": 2,
  "wis": 12,
  "cha": 5,
  "speed": 50,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0 (10 XP)",
  "features": [
   "Pack Tactics|The hyena has advantage on an attack roll against a creature if at least one of the hyena's allies is within 5 ft. of the creature and the ally isn't incapacitated."
  ]
 },
 "ice-devil": {
  "cr": 14,
  "ac": 18,
  "hp": 180,
  "hp_roll": "19d10+76",
  "str": 21,
  "dex": 14,
  "con": 18,
  "int": 18,
  "wis": 15,
  "cha": 18,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "languages": [
   "Infernal",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [
   "fire",
   "poison"
  ],
  "vuln": [],
  "description": "Large fiend, CR 14 (11500 XP)",
  "features": [
   "Devil's Sight|Magical darkness doesn't impede the devil's darkvision.",
   "Magic Resistance|The devil has advantage on saving throws against spells and other magical effects."
  ]
 },
 "ice-mephit": {
  "cr": 0.5,
  "ac": 11,
  "hp": 21,
  "hp_roll": "6d6",
  "str": 7,
  "dex": 13,
  "con": 10,
  "int": 9,
  "wis": 11,
  "cha": 12,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Aquan",
   "Auran"
  ],
  "resist": [],
  "immune": [
   "cold",
   "poison"
  ],
  "vuln": [
   "bludgeoning",
   "fire"
  ],
  "description": "Small elemental, CR 0.5 (100 XP)",
  "features": [
   "Death Burst|When the mephit dies, it explodes in a burst of jagged ice. Each creature within 5 ft. of it must make a DC 10 Dexterity saving throw, taking 4 (1d8) slashing damage on a failed save, or half as much damage on a successful one.",
   "False Appearance|While the mephit remains motionless, it is indistinguishable from an ordinary shard of ice.",
   "Innate Spellcasting|The mephit can innately cast fog cloud, requiring no material components. Its innate spellcasting ability is Charisma."
  ]
 },
 "imp": {
  "cr": 1,
  "ac": 13,
  "hp": 10,
  "hp_roll": "3d4+3",
  "str": 6,
  "dex": 17,
  "con": 13,
  "int": 11,
  "wis": 12,
  "cha": 14,
  "speed": 20,
  "darkvision": 120,
  "skill_prof": [
   "deception",
   "insight",
   "persuasion",
   "stealth"
  ],
  "languages": [
   "Infernal",
   "Common"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "cold"
  ],
  "immune": [
   "fire",
   "poison"
  ],
  "vuln": [],
  "description": "Tiny fiend, CR 1 (200 XP)",
  "features": [
   "Shapechanger|The imp can use its action to polymorph into a beast form that resembles a rat (speed 20 ft.), a raven (20 ft., fly 60 ft.), or a spider (20 ft., climb 20 ft.), or back into its true form. Its statistics are the same in each form, except for the speed changes noted. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Devil's Sight|Magical darkness doesn't impede the imp's darkvision.",
   "Magic Resistance|The imp has advantage on saving throws against spells and other magical effects."
  ]
 },
 "invisible-stalker": {
  "cr": 6,
  "ac": 14,
  "hp": 104,
  "hp_roll": "16d8+32",
  "str": 16,
  "dex": 19,
  "con": 14,
  "int": 10,
  "wis": 15,
  "cha": 11,
  "speed": 50,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Auran",
   "understands Common but doesn't speak it"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Medium elemental, CR 6 (2300 XP)",
  "features": [
   "Invisibility|The stalker is invisible.",
   "Faultless Tracker|The stalker is given a quarry by its summoner. The stalker knows the direction and distance to its quarry as long as the two of them are on the same plane of existence. The stalker also knows the location of its summoner."
  ]
 },
 "iron-golem": {
  "cr": 16,
  "ac": 20,
  "hp": 210,
  "hp_roll": "20d10+100",
  "str": 24,
  "dex": 9,
  "con": 20,
  "int": 3,
  "wis": 11,
  "cha": 1,
  "speed": 30,
  "darkvision": 120,
  "languages": [
   "understands the languages of its creator but can't speak"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing",
   "fire",
   "poison",
   "psychic"
  ],
  "vuln": [],
  "description": "Large construct, CR 16 (15000 XP)",
  "features": [
   "Fire Absorption|Whenever the golem is subjected to fire damage, it takes no damage and instead regains a number of hit points equal to the fire damage dealt.",
   "Immutable Form|The golem is immune to any spell or effect that would alter its form.",
   "Magic Resistance|The golem has advantage on saving throws against spells and other magical effects.",
   "Magic Weapons|The golem's weapon attacks are magical."
  ]
 },
 "jackal": {
  "cr": 0,
  "ac": 12,
  "hp": 3,
  "hp_roll": "1d6",
  "str": 8,
  "dex": 15,
  "con": 11,
  "int": 3,
  "wis": 12,
  "cha": 6,
  "speed": 40,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Small beast, CR 0 (10 XP)",
  "features": [
   "Keen Hearing and Smell|The jackal has advantage on Wisdom (Perception) checks that rely on hearing or smell.",
   "Pack Tactics|The jackal has advantage on an attack roll against a creature if at least one of the jackal's allies is within 5 ft. of the creature and the ally isn't incapacitated."
  ]
 },
 "killer-whale": {
  "cr": 3,
  "ac": 12,
  "hp": 90,
  "hp_roll": "12d12+12",
  "str": 19,
  "dex": 10,
  "con": 13,
  "int": 3,
  "wis": 12,
  "cha": 7,
  "speed": 30,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Huge beast, CR 3 (700 XP)",
  "features": [
   "Echolocation|The whale can't use its blindsight while deafened.",
   "Hold Breath|The whale can hold its breath for 30 minutes",
   "Keen Hearing|The whale has advantage on Wisdom (Perception) checks that rely on hearing."
  ]
 },
 "knight": {
  "cr": 3,
  "ac": 18,
  "hp": 52,
  "hp_roll": "8d8+16",
  "str": 16,
  "dex": 11,
  "con": 14,
  "int": 11,
  "wis": 11,
  "cha": 15,
  "speed": 30,
  "save_prof": [
   "con",
   "wis"
  ],
  "languages": [
   "any one language (usually Common)"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 3 (700 XP)",
  "features": [
   "Brave|The knight has advantage on saving throws against being frightened."
  ]
 },
 "kobold": {
  "cr": 0.125,
  "ac": 12,
  "hp": 5,
  "hp_roll": "2d6-2",
  "str": 7,
  "dex": 15,
  "con": 9,
  "int": 8,
  "wis": 7,
  "cha": 8,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Small humanoid, CR 0.125 (25 XP)",
  "features": [
   "Sunlight Sensitivity|While in sunlight, the kobold has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.",
   "Pack Tactics|The kobold has advantage on an attack roll against a creature if at least one of the kobold's allies is within 5 ft. of the creature and the ally isn't incapacitated."
  ]
 },
 "kraken": {
  "cr": 23,
  "ac": 18,
  "hp": 472,
  "hp_roll": "27d20+189",
  "str": 30,
  "dex": 11,
  "con": 25,
  "int": 22,
  "wis": 18,
  "cha": 20,
  "speed": 20,
  "save_prof": [
   "str",
   "dex",
   "con",
   "int",
   "wis"
  ],
  "languages": [
   "understands Abyssal",
   "Celestial",
   "Infernal",
   "and Primordial but can't speak",
   "telepathy 120 ft."
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing",
   "lightning"
  ],
  "vuln": [],
  "description": "Gargantuan monstrosity, CR 23 (50000 XP)",
  "features": [
   "Amphibious|The kraken can breathe air and water.",
   "Freedom of Movement|The kraken ignores difficult terrain, and magical effects can't reduce its speed or cause it to be restrained. It can spend 5 feet of movement to escape from nonmagical restraints or being grappled.",
   "Siege Monster|The kraken deals double damage to objects and structures."
  ]
 },
 "lamia": {
  "cr": 4,
  "ac": 13,
  "hp": 97,
  "hp_roll": "13d10+26",
  "str": 16,
  "dex": 13,
  "con": 15,
  "int": 14,
  "wis": 15,
  "cha": 16,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "deception",
   "insight",
   "stealth"
  ],
  "languages": [
   "Abyssal",
   "Common"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 4 (1100 XP)",
  "features": [
   "Innate Spellcasting|The lamia's innate spellcasting ability is Charisma (spell save DC 13). It can innately cast the following spells, requiring no material components. At will: disguise self (any humanoid form), major image 3/day each: charm person, mirror image, scrying, suggestion 1/day: geas"
  ]
 },
 "lemure": {
  "cr": 0,
  "ac": 7,
  "hp": 13,
  "hp_roll": "3d8",
  "str": 10,
  "dex": 5,
  "con": 11,
  "int": 1,
  "wis": 11,
  "cha": 3,
  "speed": 15,
  "darkvision": 120,
  "languages": [
   "understands infernal but can't speak"
  ],
  "resist": [
   "cold"
  ],
  "immune": [
   "fire",
   "poison"
  ],
  "vuln": [],
  "description": "Medium fiend, CR 0 (10 XP)",
  "features": [
   "Devil's Sight|Magical darkness doesn't impede the lemure's darkvision.",
   "Hellish Rejuvenation|A lemure that dies in the Nine Hells comes back to life with all its hit points in 1d10 days unless it is killed by a good-aligned creature with a bless spell cast on that creature or its remains are sprinkled with holy water."
  ]
 },
 "lich": {
  "cr": 21,
  "ac": 17,
  "hp": 135,
  "hp_roll": "18d8+54",
  "str": 11,
  "dex": 16,
  "con": 16,
  "int": 20,
  "wis": 14,
  "cha": 16,
  "speed": 30,
  "save_prof": [
   "con",
   "int",
   "wis"
  ],
  "skill_prof": [
   "arcana",
   "history",
   "insight",
   "perception"
  ],
  "languages": [
   "Common plus up to five other languages"
  ],
  "resist": [
   "cold",
   "lightning",
   "necrotic"
  ],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing",
   "poison"
  ],
  "vuln": [],
  "description": "Medium undead, CR 21 (33000 XP)",
  "features": [
   "Legendary Resistance|If the lich fails a saving throw, it can choose to succeed instead.",
   "Rejuvenation|If it has a phylactery, a destroyed lich gains a new body in 1d10 days, regaining all its hit points and becoming active again. The new body appears within 5 feet of the phylactery.",
   "Spellcasting|The lich is an 18th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 20, +12 to hit with spell attacks). The lich has the following wizard spells prepared:",
   "Turn Resistance|The lich has advantage on saving throws against any effect that turns undead."
  ]
 },
 "lion": {
  "cr": 1,
  "ac": 12,
  "hp": 26,
  "hp_roll": "4d10+4",
  "str": 17,
  "dex": 15,
  "con": 13,
  "int": 3,
  "wis": 12,
  "cha": 8,
  "speed": 50,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 1 (200 XP)",
  "features": [
   "Keen Smell|The lion has advantage on Wisdom (Perception) checks that rely on smell.",
   "Pack Tactics|The lion has advantage on an attack roll against a creature if at least one of the lion's allies is within 5 ft. of the creature and the ally isn't incapacitated.",
   "Pounce|If the lion moves at least 20 ft. straight toward a creature and then hits it with a claw attack on the same turn, that target must succeed on a DC 13 Strength saving throw or be knocked prone. If the target is prone, the lion can make one bite attack against it as a bonus action.",
   "Running Leap|With a 10-foot running start, the lion can long jump up to 25 ft.."
  ]
 },
 "lizard": {
  "cr": 0,
  "ac": 10,
  "hp": 2,
  "hp_roll": "1d4",
  "str": 2,
  "dex": 11,
  "con": 10,
  "int": 1,
  "wis": 8,
  "cha": 3,
  "speed": 20,
  "darkvision": 30,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0 (10 XP)"
 },
 "lizardfolk": {
  "cr": 0.5,
  "ac": 13,
  "hp": 22,
  "hp_roll": "4d8+4",
  "str": 15,
  "dex": 10,
  "con": 13,
  "int": 7,
  "wis": 12,
  "cha": 7,
  "speed": 30,
  "skill_prof": [
   "perception",
   "stealth",
   "survival"
  ],
  "languages": [
   "Draconic"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.5 (100 XP)",
  "features": [
   "Hold Breath|The lizardfolk can hold its breath for 15 minutes."
  ]
 },
 "mage": {
  "cr": 6,
  "ac": 12,
  "hp": 40,
  "hp_roll": "9d8",
  "str": 9,
  "dex": 14,
  "con": 11,
  "int": 17,
  "wis": 12,
  "cha": 11,
  "speed": 30,
  "save_prof": [
   "int",
   "wis"
  ],
  "skill_prof": [
   "arcana",
   "history"
  ],
  "languages": [
   "any four languages"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 6 (2300 XP)",
  "features": [
   "Spellcasting|The mage is a 9th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 14, +6 to hit with spell attacks). The mage has the following wizard spells prepared:"
  ]
 },
 "magma-mephit": {
  "cr": 0.5,
  "ac": 11,
  "hp": 22,
  "hp_roll": "5d6+5",
  "str": 8,
  "dex": 12,
  "con": 12,
  "int": 7,
  "wis": 10,
  "cha": 10,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "stealth"
  ],
  "languages": [
   "Ignan",
   "Terran"
  ],
  "resist": [],
  "immune": [
   "fire",
   "poison"
  ],
  "vuln": [
   "cold"
  ],
  "description": "Small elemental, CR 0.5 (100 XP)",
  "features": [
   "Death Burst|When the mephit dies, it explodes in a burst of lava. Each creature within 5 ft. of it must make a DC 11 Dexterity saving throw, taking 7 (2d6) fire damage on a failed save, or half as much damage on a successful one.",
   "False Appearance|While the mephit remains motionless, it is indistinguishable from an ordinary mound of magma.",
   "Innate Spellcasting|The mephit can innately cast heat metal (spell save DC 10), requiring no material components. Its innate spellcasting ability is Charisma."
  ]
 },
 "magmin": {
  "cr": 0.5,
  "ac": 14,
  "hp": 9,
  "hp_roll": "2d6+2",
  "str": 7,
  "dex": 15,
  "con": 12,
  "int": 8,
  "wis": 11,
  "cha": 10,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "Ignan"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Small elemental, CR 0.5 (100 XP)",
  "features": [
   "Death Burst|When the magmin dies, it explodes in a burst of fire and magma. Each creature within 10 ft. of it must make a DC 11 Dexterity saving throw, taking 7 (2d6) fire damage on a failed save, or half as much damage on a successful one. Flammable objects that aren't being worn or carried in that area are ignited.",
   "Ignited Illumination|As a bonus action, the magmin can set itself ablaze or extinguish its flames. While ablaze, the magmin sheds bright light in a 10-foot radius and dim light for an additional 10 ft."
  ]
 },
 "mammoth": {
  "cr": 6,
  "ac": 13,
  "hp": 126,
  "hp_roll": "11d12+55",
  "str": 24,
  "dex": 9,
  "con": 21,
  "int": 3,
  "wis": 11,
  "cha": 6,
  "speed": 40,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Huge beast, CR 6 (2300 XP)",
  "features": [
   "Trampling Charge|If the mammoth moves at least 20 ft. straight toward a creature and then hits it with a gore attack on the same turn, that target must succeed on a DC 18 Strength saving throw or be knocked prone. If the target is prone, the mammoth can make one stomp attack against it as a bonus action."
  ]
 },
 "manticore": {
  "cr": 3,
  "ac": 14,
  "hp": 68,
  "hp_roll": "8d10+24",
  "str": 17,
  "dex": 16,
  "con": 17,
  "int": 7,
  "wis": 12,
  "cha": 8,
  "speed": 30,
  "darkvision": 60,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 3 (700 XP)",
  "features": [
   "Tail Spike Regrowth|The manticore has twenty-four tail spikes. Used spikes regrow when the manticore finishes a long rest."
  ]
 },
 "marilith": {
  "cr": 16,
  "ac": 18,
  "hp": 189,
  "hp_roll": "18d10+90",
  "str": 18,
  "dex": 20,
  "con": 20,
  "int": 18,
  "wis": 16,
  "cha": 20,
  "speed": 40,
  "save_prof": [
   "str",
   "con",
   "wis",
   "cha"
  ],
  "languages": [
   "Abyssal",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "fire",
   "cold",
   "lightning"
  ],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Large fiend, CR 16 (15000 XP)",
  "features": [
   "Magic Resistance|The marilith has advantage on saving throws against spells and other magical effects.",
   "Magic Weapons|The marilith's weapon attacks are magical.",
   "Reactive|The marilith can take one reaction on every turn in combat."
  ]
 },
 "mastiff": {
  "cr": 0.125,
  "ac": 12,
  "hp": 5,
  "hp_roll": "1d8+1",
  "str": 13,
  "dex": 14,
  "con": 12,
  "int": 3,
  "wis": 12,
  "cha": 7,
  "speed": 40,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.125 (25 XP)",
  "features": [
   "Keen Hearing and Smell|The mastiff has advantage on Wisdom (Perception) checks that rely on hearing or smell."
  ]
 },
 "medusa": {
  "cr": 6,
  "ac": 15,
  "hp": 127,
  "hp_roll": "17d8+51",
  "str": 10,
  "dex": 15,
  "con": 16,
  "int": 12,
  "wis": 13,
  "cha": 15,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "deception",
   "insight",
   "perception",
   "stealth"
  ],
  "languages": [
   "Common"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium monstrosity, CR 6 (2300 XP)",
  "features": [
   "Petrifying Gaze|When a creature that can see the medusa's eyes starts its turn within 30 ft. of the medusa, the medusa can force it to make a DC 14 Constitution saving throw if the medusa isn't incapacitated and can see the creature. If the saving throw fails by 5 or more, the creature is instantly petrified. Otherwise, a creature that fails the save begins to turn to stone and is restrained. The restrained creature must repeat the saving throw at the end of its next turn, becoming petrified on a failure or ending the effect on a success. The petrification lasts until the creature is freed by the greater restoration spell or other magic."
  ]
 },
 "merfolk": {
  "cr": 0.125,
  "ac": 11,
  "hp": 11,
  "hp_roll": "2d8+2",
  "str": 10,
  "dex": 13,
  "con": 12,
  "int": 11,
  "wis": 11,
  "cha": 12,
  "speed": 10,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "Aquan",
   "Common"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.125 (25 XP)",
  "features": [
   "Amphibious|The merfolk can breathe air and water."
  ]
 },
 "merrow": {
  "cr": 2,
  "ac": 13,
  "hp": 45,
  "hp_roll": "6d10+12",
  "str": 18,
  "dex": 10,
  "con": 15,
  "int": 8,
  "wis": 10,
  "cha": 9,
  "speed": 10,
  "darkvision": 60,
  "languages": [
   "Abyssal",
   "Aquan"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 2 (450 XP)",
  "features": [
   "Amphibious|The merrow can breathe air and water."
  ]
 },
 "mimic": {
  "cr": 2,
  "ac": 12,
  "hp": 58,
  "hp_roll": "9d8+18",
  "str": 17,
  "dex": 12,
  "con": 15,
  "int": 5,
  "wis": 13,
  "cha": 8,
  "speed": 15,
  "darkvision": 60,
  "skill_prof": [
   "stealth"
  ],
  "resist": [],
  "immune": [
   "acid"
  ],
  "vuln": [],
  "description": "Medium monstrosity, CR 2 (450 XP)",
  "features": [
   "Shapechanger|The mimic can use its action to polymorph into an object or back into its true, amorphous form. Its statistics are the same in each form. Any equipment it is wearing or carrying isn 't transformed. It reverts to its true form if it dies.",
   "Adhesive (Object Form Only)|The mimic adheres to anything that touches it. A Huge or smaller creature adhered to the mimic is also grappled by it (escape DC 13). Ability checks made to escape this grapple have disadvantage.",
   "False Appearance (Object Form Only)|While the mimic remains motionless, it is indistinguishable from an ordinary object.",
   "Grappler|The mimic has advantage on attack rolls against any creature grappled by it."
  ]
 },
 "minotaur": {
  "cr": 3,
  "ac": 14,
  "hp": 76,
  "hp_roll": "9d10+27",
  "str": 18,
  "dex": 11,
  "con": 16,
  "int": 6,
  "wis": 16,
  "cha": 9,
  "speed": 40,
  "darkvision": 60,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "Abyssal"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 3 (700 XP)",
  "features": [
   "Charge|If the minotaur moves at least 10 ft. straight toward a target and then hits it with a gore attack on the same turn, the target takes an extra 9 (2d8) piercing damage. If the target is a creature, it must succeed on a DC 14 Strength saving throw or be pushed up to 10 ft. away and knocked prone.",
   "Labyrinthine Recall|The minotaur can perfectly recall any path it has traveled.",
   "Reckless|At the start of its turn, the minotaur can gain advantage on all melee weapon attack rolls it makes during that turn, but attack rolls against it have advantage until the start of its next turn."
  ]
 },
 "minotaur-skeleton": {
  "cr": 2,
  "ac": 12,
  "hp": 67,
  "hp_roll": "9d10+18",
  "str": 18,
  "dex": 11,
  "con": 15,
  "int": 6,
  "wis": 8,
  "cha": 5,
  "speed": 40,
  "darkvision": 60,
  "languages": [
   "understands Abyssal but can't speak"
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [
   "bludgeoning"
  ],
  "description": "Large undead, CR 2 (450 XP)",
  "features": [
   "Charge|If the skeleton moves at least 10 feet straight toward a target and then hits it with a gore attack on the same turn, the target takes an extra 9 (2d8) piercing damage. If the target is a creature, it must succeed on a DC 14 Strength saving throw or be pushed up to 10 feet away and knocked prone."
  ]
 },
 "mule": {
  "cr": 0.125,
  "ac": 10,
  "hp": 11,
  "hp_roll": "2d8+2",
  "str": 14,
  "dex": 10,
  "con": 13,
  "int": 2,
  "wis": 10,
  "cha": 5,
  "speed": 40,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.125 (25 XP)",
  "features": [
   "Beast of Burden|The mule is considered to be a Large animal for the purpose of determining its carrying capacity.",
   "Sure-Footed|The mule has advantage on Strength and Dexterity saving throws made against effects that would knock it prone."
  ]
 },
 "mummy": {
  "cr": 3,
  "ac": 11,
  "hp": 58,
  "hp_roll": "9d8+18",
  "str": 16,
  "dex": 8,
  "con": 15,
  "int": 6,
  "wis": 10,
  "cha": 12,
  "speed": 20,
  "darkvision": 60,
  "save_prof": [
   "wis"
  ],
  "languages": [
   "the languages it knew in life"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [
   "poison",
   "necrotic"
  ],
  "vuln": [
   "fire"
  ],
  "description": "Medium undead, CR 3 (700 XP)"
 },
 "mummy-lord": {
  "cr": 15,
  "ac": 17,
  "hp": 97,
  "hp_roll": "13d8+39",
  "str": 18,
  "dex": 10,
  "con": 17,
  "int": 11,
  "wis": 18,
  "cha": 16,
  "speed": 20,
  "darkvision": 60,
  "save_prof": [
   "con",
   "int",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "history",
   "religion"
  ],
  "languages": [
   "the languages it knew in life"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing",
   "poison",
   "necrotic"
  ],
  "vuln": [
   "fire"
  ],
  "description": "Medium undead, CR 15 (13000 XP)",
  "features": [
   "Magic Resistance|The mummy lord has advantage on saving throws against spells and other magical effects.",
   "Rejuvenation|A destroyed mummy lord gains a new body in 24 hours if its heart is intact, regaining all its hit points and becoming active again. The new body appears within 5 feet of the mummy lord's heart.",
   "Spellcasting|The mummy lord is a 10th-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 17, +9 to hit with spell attacks). The mummy lord has the following cleric spells prepared:"
  ]
 },
 "nalfeshnee": {
  "cr": 13,
  "ac": 18,
  "hp": 184,
  "hp_roll": "16d10+96",
  "str": 21,
  "dex": 10,
  "con": 22,
  "int": 19,
  "wis": 12,
  "cha": 15,
  "speed": 20,
  "save_prof": [
   "con",
   "int",
   "wis",
   "cha"
  ],
  "languages": [
   "Abyssal",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "fire",
   "cold",
   "lightning"
  ],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Large fiend, CR 13 (10000 XP)",
  "features": [
   "Magic Resistance|The nalfeshnee has advantage on saving throws against spells and other magical effects."
  ]
 },
 "night-hag": {
  "cr": 5,
  "ac": 17,
  "hp": 112,
  "hp_roll": "15d8+45",
  "str": 18,
  "dex": 15,
  "con": 16,
  "int": 16,
  "wis": 14,
  "cha": 16,
  "speed": 30,
  "darkvision": 120,
  "skill_prof": [
   "deception",
   "insight",
   "perception",
   "stealth"
  ],
  "languages": [
   "Abyssal",
   "Common",
   "Infernal",
   "Primordial"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "fire",
   "cold"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium fiend, CR 5 (1800 XP)",
  "features": [
   "Innate Spellcasting|The hag's innate spellcasting ability is Charisma (spell save DC 14, +6 to hit with spell attacks). She can innately cast the following spells, requiring no material components:",
   "Magic Resistance|The hag has advantage on saving throws against spells and other magical effects.",
   "Night Hag Items|A night hag carries two very rare magic items that she must craft for herself If either object is lost, the night hag will go to great lengths to retrieve it, as creating a new tool takes time and effort."
  ]
 },
 "nightmare": {
  "cr": 3,
  "ac": 13,
  "hp": 68,
  "hp_roll": "8d10+24",
  "str": 18,
  "dex": 15,
  "con": 16,
  "int": 10,
  "wis": 13,
  "cha": 15,
  "speed": 60,
  "languages": [
   "understands Abyssal",
   "Common",
   "and Infernal but can't speak"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Large fiend, CR 3 (700 XP)",
  "features": [
   "Confer Fire Resistance|The nightmare can grant resistance to fire damage to anyone riding it.",
   "Illumination|The nightmare sheds bright light in a 10-foot radius and dim light for an additional 10 feet."
  ]
 },
 "noble": {
  "cr": 0.125,
  "ac": 15,
  "hp": 9,
  "hp_roll": "2d8",
  "str": 11,
  "dex": 12,
  "con": 11,
  "int": 12,
  "wis": 14,
  "cha": 16,
  "speed": 30,
  "skill_prof": [
   "deception",
   "insight",
   "persuasion"
  ],
  "languages": [
   "any two languages"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.125 (25 XP)"
 },
 "ochre-jelly": {
  "cr": 2,
  "ac": 8,
  "hp": 45,
  "hp_roll": "6d10+12",
  "str": 15,
  "dex": 6,
  "con": 14,
  "int": 2,
  "wis": 6,
  "cha": 1,
  "speed": 10,
  "resist": [
   "acid"
  ],
  "immune": [
   "slashing",
   "lightning"
  ],
  "vuln": [],
  "description": "Large ooze, CR 2 (450 XP)",
  "features": [
   "Amorphous|The jelly can move through a space as narrow as 1 inch wide without squeezing.",
   "Spider Climb|The jelly can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check."
  ]
 },
 "octopus": {
  "cr": 0,
  "ac": 12,
  "hp": 3,
  "hp_roll": "1d6",
  "str": 4,
  "dex": 15,
  "con": 11,
  "int": 3,
  "wis": 10,
  "cha": 4,
  "speed": 5,
  "darkvision": 30,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Small beast, CR 0 (10 XP)",
  "features": [
   "Hold Breath|While out of water, the octopus can hold its breath for 30 minutes.",
   "Underwater Camouflage|The octopus has advantage on Dexterity (Stealth) checks made while underwater.",
   "Water Breathing|The octopus can breathe only underwater."
  ]
 },
 "ogre": {
  "cr": 2,
  "ac": 11,
  "hp": 59,
  "hp_roll": "7d10+21",
  "str": 19,
  "dex": 8,
  "con": 16,
  "int": 5,
  "wis": 7,
  "cha": 7,
  "speed": 40,
  "darkvision": 60,
  "languages": [
   "Common",
   "Giant"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large giant, CR 2 (450 XP)"
 },
 "ogre-zombie": {
  "cr": 2,
  "ac": 8,
  "hp": 85,
  "hp_roll": "9d10+36",
  "str": 19,
  "dex": 6,
  "con": 18,
  "int": 3,
  "wis": 6,
  "cha": 5,
  "speed": 30,
  "darkvision": 60,
  "save_prof": [
   "wis"
  ],
  "languages": [
   "understands Common and Giant but can't speak"
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Large undead, CR 2 (450 XP)",
  "features": [
   "Undead Fortitude|If damage reduces the zombie to 0 hit points, it must make a Constitution saving throw with a DC of 5+the damage taken, unless the damage is radiant or from a critical hit. On a success, the zombie drops to 1 hit point instead."
  ]
 },
 "oni": {
  "cr": 7,
  "ac": 16,
  "hp": 110,
  "hp_roll": "13d10+39",
  "str": 19,
  "dex": 11,
  "con": 16,
  "int": 14,
  "wis": 12,
  "cha": 15,
  "speed": 30,
  "darkvision": 60,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "arcana",
   "deception",
   "perception"
  ],
  "languages": [
   "Common",
   "Giant"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large giant, CR 7 (2900 XP)",
  "features": [
   "Innate Spellcasting|The oni's innate spellcasting ability is Charisma (spell save DC 13). The oni can innately cast the following spells, requiring no material components:",
   "Magic Weapons|The oni's weapon attacks are magical.",
   "Regeneration|The oni regains 10 hit points at the start of its turn if it has at least 1 hit point."
  ]
 },
 "orc": {
  "cr": 0.5,
  "ac": 13,
  "hp": 15,
  "hp_roll": "2d8+6",
  "str": 16,
  "dex": 12,
  "con": 16,
  "int": 7,
  "wis": 11,
  "cha": 10,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "intimidation"
  ],
  "languages": [
   "Common",
   "Orc"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.5 (100 XP)",
  "features": [
   "Aggressive|As a bonus action, the orc can move up to its speed toward a hostile creature that it can see."
  ]
 },
 "otyugh": {
  "cr": 5,
  "ac": 14,
  "hp": 114,
  "hp_roll": "12d10+48",
  "str": 16,
  "dex": 11,
  "con": 19,
  "int": 6,
  "wis": 13,
  "cha": 6,
  "speed": 30,
  "darkvision": 120,
  "save_prof": [
   "con"
  ],
  "languages": [
   "Otyugh"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large aberration, CR 5 (1800 XP)",
  "features": [
   "Limited Telepathy|The otyugh can magically transmit simple messages and images to any creature within 120 ft. of it that can understand a language. This form of telepathy doesn't allow the receiving creature to telepathically respond."
  ]
 },
 "owl": {
  "cr": 0,
  "ac": 11,
  "hp": 1,
  "hp_roll": "1d4-1",
  "str": 3,
  "dex": 13,
  "con": 8,
  "int": 2,
  "wis": 12,
  "cha": 7,
  "speed": 5,
  "darkvision": 120,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0 (10 XP)",
  "features": [
   "Flyby|The owl doesn't provoke opportunity attacks when it flies out of an enemy's reach.",
   "Keen Hearing and Sight|The owl has advantage on Wisdom (Perception) checks that rely on hearing or sight."
  ]
 },
 "owlbear": {
  "cr": 3,
  "ac": 13,
  "hp": 59,
  "hp_roll": "7d10+21",
  "str": 20,
  "dex": 12,
  "con": 17,
  "int": 3,
  "wis": 12,
  "cha": 7,
  "speed": 40,
  "darkvision": 60,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 3 (700 XP)",
  "features": [
   "Keen Sight and Smell|The owlbear has advantage on Wisdom (Perception) checks that rely on sight or smell."
  ]
 },
 "panther": {
  "cr": 0.25,
  "ac": 12,
  "hp": 13,
  "hp_roll": "3d8",
  "str": 14,
  "dex": 15,
  "con": 10,
  "int": 3,
  "wis": 14,
  "cha": 7,
  "speed": 50,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.25 (50 XP)",
  "features": [
   "Keen Smell|The panther has advantage on Wisdom (Perception) checks that rely on smell.",
   "Pounce|If the panther moves at least 20 ft. straight toward a creature and then hits it with a claw attack on the same turn, that target must succeed on a DC 12 Strength saving throw or be knocked prone. If the target is prone, the panther can make one bite attack against it as a bonus action."
  ]
 },
 "pegasus": {
  "cr": 2,
  "ac": 12,
  "hp": 59,
  "hp_roll": "7d10+21",
  "str": 18,
  "dex": 15,
  "con": 16,
  "int": 10,
  "wis": 15,
  "cha": 13,
  "speed": 60,
  "save_prof": [
   "dex",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "understands Celestial",
   "Common",
   "Elvish",
   "and Sylvan but can't speak"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large celestial, CR 2 (450 XP)"
 },
 "phase-spider": {
  "cr": 3,
  "ac": 13,
  "hp": 32,
  "hp_roll": "5d10+5",
  "str": 15,
  "dex": 15,
  "con": 12,
  "int": 6,
  "wis": 10,
  "cha": 6,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 3 (700 XP)",
  "features": [
   "Ethereal Jaunt|As a bonus action, the spider can magically shift from the Material Plane to the Ethereal Plane, or vice versa.",
   "Spider Climb|The spider can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.",
   "Web Walker|The spider ignores movement restrictions caused by webbing."
  ]
 },
 "pit-fiend": {
  "cr": 20,
  "ac": 19,
  "hp": 300,
  "hp_roll": "24d10+168",
  "str": 26,
  "dex": 14,
  "con": 24,
  "int": 22,
  "wis": 18,
  "cha": 24,
  "speed": 30,
  "save_prof": [
   "dex",
   "con",
   "wis"
  ],
  "languages": [
   "Infernal",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "cold"
  ],
  "immune": [
   "fire",
   "poison"
  ],
  "vuln": [],
  "description": "Large fiend, CR 20 (25000 XP)",
  "features": [
   "Fear Aura|Any creature hostile to the pit fiend that starts its turn within 20 feet of the pit fiend must make a DC 21 Wisdom saving throw, unless the pit fiend is incapacitated. On a failed save, the creature is frightened until the start of its next turn. If a creature's saving throw is successful, the creature is immune to the pit fiend's Fear Aura for the next 24 hours.",
   "Magic Resistance|The pit fiend has advantage on saving throws against spells and other magical effects.",
   "Magic Weapons|The pit fiend's weapon attacks are magical.",
   "Innate Spellcasting|The pit fiend's spellcasting ability is Charisma (spell save DC 21). The pit fiend can innately cast the following spells, requiring no material components:"
  ]
 },
 "planetar": {
  "cr": 16,
  "ac": 19,
  "hp": 200,
  "hp_roll": "16d10+112",
  "str": 24,
  "dex": 20,
  "con": 24,
  "int": 19,
  "wis": 22,
  "cha": 25,
  "speed": 40,
  "save_prof": [
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "all",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "radiant"
  ],
  "immune": [],
  "vuln": [],
  "description": "Large celestial, CR 16 (15000 XP)",
  "features": [
   "Angelic Weapons|The planetar's weapon attacks are magical. When the planetar hits with any weapon, the weapon deals an extra 5d8 radiant damage (included in the attack).",
   "Divine Awareness|The planetar knows if it hears a lie.",
   "Innate Spellcasting|The planetar's spellcasting ability is Charisma (spell save DC 20). The planetar can innately cast the following spells, requiring no material components:",
   "Magic Resistance|The planetar has advantage on saving throws against spells and other magical effects."
  ]
 },
 "plesiosaurus": {
  "cr": 2,
  "ac": 13,
  "hp": 68,
  "hp_roll": "8d10+24",
  "str": 18,
  "dex": 15,
  "con": 16,
  "int": 2,
  "wis": 12,
  "cha": 5,
  "speed": 20,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 2 (450 XP)",
  "features": [
   "Hold Breath|The plesiosaurus can hold its breath for 1 hour."
  ]
 },
 "poisonous-snake": {
  "cr": 0.125,
  "ac": 13,
  "hp": 2,
  "hp_roll": "1d4",
  "str": 2,
  "dex": 16,
  "con": 11,
  "int": 1,
  "wis": 10,
  "cha": 3,
  "speed": 30,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0.125 (25 XP)"
 },
 "polar-bear": {
  "cr": 2,
  "ac": 12,
  "hp": 42,
  "hp_roll": "5d10+15",
  "str": 20,
  "dex": 10,
  "con": 16,
  "int": 2,
  "wis": 13,
  "cha": 7,
  "speed": 40,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 2 (450 XP)",
  "features": [
   "Keen Smell|The bear has advantage on Wisdom (Perception) checks that rely on smell."
  ]
 },
 "pony": {
  "cr": 0.125,
  "ac": 10,
  "hp": 11,
  "hp_roll": "2d8+2",
  "str": 15,
  "dex": 10,
  "con": 13,
  "int": 2,
  "wis": 11,
  "cha": 7,
  "speed": 40,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.125 (25 XP)"
 },
 "priest": {
  "cr": 2,
  "ac": 13,
  "hp": 27,
  "hp_roll": "5d8+5",
  "str": 10,
  "dex": 10,
  "con": 12,
  "int": 13,
  "wis": 16,
  "cha": 13,
  "speed": 25,
  "skill_prof": [
   "medicine",
   "persuasion",
   "religion"
  ],
  "languages": [
   "any two languages"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 2 (450 XP)",
  "features": [
   "Divine Eminence|As a bonus action, the priest can expend a spell slot to cause its melee weapon attacks to magically deal an extra 10 (3d6) radiant damage to a target on a hit. This benefit lasts until the end of the turn. If the priest expends a spell slot of 2nd level or higher, the extra damage increases by 1d6 for each level above 1st.",
   "Spellcasting|The priest is a 5th-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 13, +5 to hit with spell attacks). The priest has the following cleric spells prepared:"
  ]
 },
 "pseudodragon": {
  "cr": 0.25,
  "ac": 13,
  "hp": 7,
  "hp_roll": "2d4+2",
  "str": 6,
  "dex": 15,
  "con": 13,
  "int": 10,
  "wis": 12,
  "cha": 10,
  "speed": 15,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "understands Common and Draconic but can't speak"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny dragon, CR 0.25 (50 XP)",
  "features": [
   "Keen Senses|The pseudodragon has advantage on Wisdom (Perception) checks that rely on sight, hearing, or smell.",
   "Magic Resistance|The pseudodragon has advantage on saving throws against spells and other magical effects.",
   "Limited Telepathy|The pseudodragon can magically communicate simple ideas, emotions, and images telepathically with any creature within 100 ft. of it that can understand a language."
  ]
 },
 "purple-worm": {
  "cr": 15,
  "ac": 18,
  "hp": 247,
  "hp_roll": "15d20+90",
  "str": 28,
  "dex": 7,
  "con": 22,
  "int": 1,
  "wis": 8,
  "cha": 4,
  "speed": 50,
  "save_prof": [
   "con",
   "wis"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Gargantuan monstrosity, CR 15 (13000 XP)",
  "features": [
   "Tunneler|The worm can burrow through solid rock at half its burrow speed and leaves a 10-foot-diameter tunnel in its wake."
  ]
 },
 "quasit": {
  "cr": 1,
  "ac": 13,
  "hp": 7,
  "hp_roll": "3d4",
  "str": 5,
  "dex": 17,
  "con": 10,
  "int": 7,
  "wis": 10,
  "cha": 10,
  "speed": 40,
  "darkvision": 120,
  "skill_prof": [
   "stealth"
  ],
  "languages": [
   "Abyssal",
   "Common"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "fire",
   "cold",
   "lightning"
  ],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Tiny fiend, CR 1 (200 XP)",
  "features": [
   "Shapechanger|The quasit can use its action to polymorph into a beast form that resembles a bat (speed 10 ft. fly 40 ft.), a centipede (40 ft., climb 40 ft.), or a toad (40 ft., swim 40 ft.), or back into its true form . Its statistics are the same in each form, except for the speed changes noted. Any equipment it is wearing or carrying isn't transformed . It reverts to its true form if it dies.",
   "Magic Resistance|The quasit has advantage on saving throws against spells and other magical effects."
  ]
 },
 "quipper": {
  "cr": 0,
  "ac": 13,
  "hp": 1,
  "hp_roll": "1d4-1",
  "str": 2,
  "dex": 16,
  "con": 9,
  "int": 1,
  "wis": 7,
  "cha": 2,
  "speed": 30,
  "darkvision": 60,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0 (10 XP)",
  "features": [
   "Blood Frenzy|The quipper has advantage on melee attack rolls against any creature that doesn't have all its hit points.",
   "Water Breathing|The quipper can breathe only underwater."
  ]
 },
 "rakshasa": {
  "cr": 13,
  "ac": 16,
  "hp": 110,
  "hp_roll": "13d8+52",
  "str": 14,
  "dex": 17,
  "con": 18,
  "int": 13,
  "wis": 16,
  "cha": 20,
  "speed": 40,
  "darkvision": 60,
  "skill_prof": [
   "deception",
   "insight"
  ],
  "languages": [
   "Common",
   "Infernal"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [
   "piercing"
  ],
  "description": "Medium fiend, CR 13 (10000 XP)",
  "features": [
   "Limited Magic Immunity|The rakshasa can't be affected or detected by spells of 6th level or lower unless it wishes to be. It has advantage on saving throws against all other spells and magical effects.",
   "Innate Spellcasting|The rakshasa's innate spellcasting ability is Charisma (spell save DC 18, +10 to hit with spell attacks). The rakshasa can innately cast the following spells, requiring no material components:"
  ]
 },
 "rat": {
  "cr": 0,
  "ac": 10,
  "hp": 1,
  "hp_roll": "1d4-1",
  "str": 2,
  "dex": 11,
  "con": 9,
  "int": 2,
  "wis": 10,
  "cha": 4,
  "speed": 20,
  "darkvision": 30,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0 (10 XP)",
  "features": [
   "Keen Smell|The rat has advantage on Wisdom (Perception) checks that rely on smell."
  ]
 },
 "raven": {
  "cr": 0,
  "ac": 12,
  "hp": 1,
  "hp_roll": "1d4-1",
  "str": 2,
  "dex": 14,
  "con": 8,
  "int": 2,
  "wis": 12,
  "cha": 6,
  "speed": 10,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0 (10 XP)",
  "features": [
   "Mimicry|The raven can mimic simple sounds it has heard, such as a person whispering, a baby crying, or an animal chittering. A creature that hears the sounds can tell they are imitations with a successful DC 10 Wisdom (Insight) check."
  ]
 },
 "red-dragon-wyrmling": {
  "cr": 4,
  "ac": 17,
  "hp": 75,
  "hp_roll": "10d8+30",
  "str": 19,
  "dex": 10,
  "con": 17,
  "int": 12,
  "wis": 11,
  "cha": 15,
  "speed": 30,
  "darkvision": 60,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Medium dragon, CR 4 (1100 XP)"
 },
 "reef-shark": {
  "cr": 0.5,
  "ac": 12,
  "hp": 22,
  "hp_roll": "4d8+4",
  "str": 14,
  "dex": 13,
  "con": 13,
  "int": 1,
  "wis": 10,
  "cha": 4,
  "speed": 30,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.5 (100 XP)",
  "features": [
   "Pack Tactics|The shark has advantage on an attack roll against a creature if at least one of the shark's allies is within 5 ft. of the creature and the ally isn't incapacitated.",
   "Water Breathing|The shark can breathe only underwater."
  ]
 },
 "remorhaz": {
  "cr": 11,
  "ac": 17,
  "hp": 195,
  "hp_roll": "17d12+85",
  "str": 24,
  "dex": 13,
  "con": 21,
  "int": 4,
  "wis": 10,
  "cha": 5,
  "speed": 30,
  "darkvision": 60,
  "resist": [],
  "immune": [
   "fire",
   "cold"
  ],
  "vuln": [],
  "description": "Huge monstrosity, CR 11 (7200 XP)",
  "features": [
   "Heated Body|A creature that touches the remorhaz or hits it with a melee attack while within 5 feet of it takes 10 (3d6) fire damage."
  ]
 },
 "rhinoceros": {
  "cr": 2,
  "ac": 11,
  "hp": 45,
  "hp_roll": "6d10+12",
  "str": 21,
  "dex": 8,
  "con": 15,
  "int": 2,
  "wis": 12,
  "cha": 6,
  "speed": 40,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 2 (450 XP)",
  "features": [
   "Charge|If the rhinoceros moves at least 20 ft. straight toward a target and then hits it with a gore attack on the same turn, the target takes an extra 9 (2d8) bludgeoning damage. If the target is a creature, it must succeed on a DC 15 Strength saving throw or be knocked prone."
  ]
 },
 "riding-horse": {
  "cr": 0.25,
  "ac": 10,
  "hp": 13,
  "hp_roll": "2d10+2",
  "str": 16,
  "dex": 10,
  "con": 12,
  "int": 2,
  "wis": 11,
  "cha": 7,
  "speed": 60,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 0.25 (25 XP)"
 },
 "roc": {
  "cr": 11,
  "ac": 15,
  "hp": 248,
  "hp_roll": "16d20+80",
  "str": 28,
  "dex": 10,
  "con": 20,
  "int": 3,
  "wis": 10,
  "cha": 9,
  "speed": 20,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Gargantuan monstrosity, CR 11 (7200 XP)",
  "features": [
   "Keen Sight|The roc has advantage on Wisdom (Perception) checks that rely on sight."
  ]
 },
 "roper": {
  "cr": 5,
  "ac": 20,
  "hp": 93,
  "hp_roll": "11d10+33",
  "str": 18,
  "dex": 8,
  "con": 17,
  "int": 7,
  "wis": 16,
  "cha": 6,
  "speed": 10,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 5 (1800 XP)",
  "features": [
   "False Appearance|While the roper remains motionless, it is indistinguishable from a normal cave formation, such as a stalagmite.",
   "Grasping Tendrils|The roper can have up to six tendrils at a time. Each tendril can be attacked (AC 20; 10 hit points; immunity to poison and psychic damage). Destroying a tendril deals no damage to the roper, which can extrude a replacement tendril on its next turn. A tendril can also be broken if a creature takes an action and succeeds on a DC 15 Strength check against it.",
   "Spider Climb|The roper can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check."
  ]
 },
 "rug-of-smothering": {
  "cr": 2,
  "ac": 12,
  "hp": 33,
  "hp_roll": "6d10",
  "str": 17,
  "dex": 14,
  "con": 10,
  "int": 1,
  "wis": 3,
  "cha": 1,
  "speed": 10,
  "resist": [],
  "immune": [
   "poison",
   "psychic"
  ],
  "vuln": [],
  "description": "Large construct, CR 2 (450 XP)",
  "features": [
   "Antimagic Susceptibility|The rug is incapacitated while in the area of an antimagic field. If targeted by dispel magic, the rug must succeed on a Constitution saving throw against the caster's spell save DC or fall unconscious for 1 minute.",
   "Damage Transfer|While it is grappling a creature, the rug takes only half the damage dealt to it, and the creature grappled by the rug takes the other half.",
   "False Appearance|While the rug remains motionless, it is indistinguishable from a normal rug."
  ]
 },
 "rust-monster": {
  "cr": 0.5,
  "ac": 14,
  "hp": 27,
  "hp_roll": "5d8+5",
  "str": 13,
  "dex": 12,
  "con": 13,
  "int": 2,
  "wis": 13,
  "cha": 6,
  "speed": 40,
  "darkvision": 60,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium monstrosity, CR 0.5 (100 XP)",
  "features": [
   "Iron Scent|The rust monster can pinpoint, by scent, the location of ferrous metal within 30 feet of it.",
   "Rust Metal|Any nonmagical weapon made of metal that hits the rust monster corrodes. After dealing damage, the weapon takes a permanent and cumulative -1 penalty to damage rolls. If its penalty drops to -5, the weapon is destroyed. Nonmagical ammunition made of metal that hits the rust monster is destroyed after dealing damage."
  ]
 },
 "saber-toothed-tiger": {
  "cr": 2,
  "ac": 12,
  "hp": 52,
  "hp_roll": "7d10+14",
  "str": 18,
  "dex": 14,
  "con": 15,
  "int": 3,
  "wis": 12,
  "cha": 8,
  "speed": 40,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 2 (450 XP)",
  "features": [
   "Keen Smell|The tiger has advantage on Wisdom (Perception) checks that rely on smell.",
   "Pounce|If the tiger moves at least 20 ft. straight toward a creature and then hits it with a claw attack on the same turn, that target must succeed on a DC 14 Strength saving throw or be knocked prone. If the target is prone, the tiger can make one bite attack against it as a bonus action."
  ]
 },
 "sahuagin": {
  "cr": 0.5,
  "ac": 12,
  "hp": 22,
  "hp_roll": "4d8+4",
  "str": 13,
  "dex": 11,
  "con": 12,
  "int": 12,
  "wis": 13,
  "cha": 9,
  "speed": 30,
  "darkvision": 120,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "Sahuagin"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.5 (100 XP)",
  "features": [
   "Blood Frenzy|The sahuagin has advantage on melee attack rolls against any creature that doesn't have all its hit points.",
   "Limited Amphibiousness|The sahuagin can breathe air and water, but it needs to be submerged at least once every 4 hours to avoid suffocating.",
   "Shark Telepathy|The sahuagin can magically command any shark within 120 feet of it, using a limited telepathy."
  ]
 },
 "salamander": {
  "cr": 5,
  "ac": 15,
  "hp": 90,
  "hp_roll": "12d10+24",
  "str": 18,
  "dex": 14,
  "con": 15,
  "int": 11,
  "wis": 10,
  "cha": 12,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "Ignan"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [
   "fire"
  ],
  "vuln": [
   "cold"
  ],
  "description": "Large elemental, CR 5 (1800 XP)",
  "features": [
   "Heated Body|A creature that touches the salamander or hits it with a melee attack while within 5 ft. of it takes 7 (2d6) fire damage.",
   "Heated Weapons|Any metal melee weapon the salamander wields deals an extra 3 (1d6) fire damage on a hit (included in the attack)."
  ]
 },
 "satyr": {
  "cr": 0.5,
  "ac": 14,
  "hp": 31,
  "hp_roll": "7d8",
  "str": 12,
  "dex": 16,
  "con": 11,
  "int": 12,
  "wis": 10,
  "cha": 14,
  "speed": 40,
  "skill_prof": [
   "perception",
   "performance",
   "stealth"
  ],
  "languages": [
   "Common",
   "Elvish",
   "Sylvan"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium fey, CR 0.5 (100 XP)",
  "features": [
   "Magic Resistance|The satyr has advantage on saving throws against spells and other magical effects."
  ]
 },
 "scorpion": {
  "cr": 0,
  "ac": 11,
  "hp": 1,
  "hp_roll": "1d4-1",
  "str": 2,
  "dex": 11,
  "con": 8,
  "int": 1,
  "wis": 8,
  "cha": 2,
  "speed": 10,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0 (10 XP)"
 },
 "scout": {
  "cr": 0.5,
  "ac": 13,
  "hp": 16,
  "hp_roll": "3d8+3",
  "str": 11,
  "dex": 14,
  "con": 12,
  "int": 11,
  "wis": 13,
  "cha": 11,
  "speed": 30,
  "skill_prof": [
   "nature",
   "perception",
   "stealth",
   "survival"
  ],
  "languages": [
   "any one language (usually Common)"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.5 (100 XP)",
  "features": [
   "Keen Hearing and Sight|The scout has advantage on Wisdom (Perception) checks that rely on hearing or sight."
  ]
 },
 "sea-hag": {
  "cr": 2,
  "ac": 14,
  "hp": 52,
  "hp_roll": "7d8+21",
  "str": 16,
  "dex": 13,
  "con": 16,
  "int": 12,
  "wis": 12,
  "cha": 13,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "Aquan",
   "Common",
   "Giant"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium fey, CR 2 (450 XP)",
  "features": [
   "Amphibious|The hag can breathe air and water.",
   "Horrific Appearance|Any humanoid that starts its turn within 30 feet of the hag and can see the hag's true form must make a DC 11 Wisdom saving throw. On a failed save, the creature is frightened for 1 minute. A creature can repeat the saving throw at the end of each of its turns, with disadvantage if the hag is within line of sight, ending the effect on itself on a success. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the hag's Horrific Appearance for the next 24 hours."
  ]
 },
 "sea-horse": {
  "cr": 0,
  "ac": 11,
  "hp": 1,
  "hp_roll": "1d4-1",
  "str": 1,
  "dex": 12,
  "con": 8,
  "int": 1,
  "wis": 10,
  "cha": 2,
  "speed": 30,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0 (0 XP)",
  "features": [
   "Water Breathing|The sea horse can breathe only underwater."
  ]
 },
 "shadow": {
  "cr": 0.5,
  "ac": 12,
  "hp": 16,
  "hp_roll": "3d8+3",
  "str": 6,
  "dex": 14,
  "con": 13,
  "int": 6,
  "wis": 10,
  "cha": 8,
  "speed": 40,
  "darkvision": 60,
  "skill_prof": [
   "stealth"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "fire",
   "cold",
   "acid",
   "lightning",
   "thunder"
  ],
  "immune": [
   "poison",
   "necrotic"
  ],
  "vuln": [
   "radiant"
  ],
  "description": "Medium undead, CR 0.5 (100 XP)",
  "features": [
   "Amorphous|The shadow can move through a space as narrow as 1 inch wide without squeezing.",
   "Shadow Stealth|While in dim light or darkness, the shadow can take the Hide action as a bonus action. Its stealth bonus is also improved to +6.",
   "Sunlight Weakness|While in sunlight, the shadow has disadvantage on attack rolls, ability checks, and saving throws."
  ]
 },
 "shambling-mound": {
  "cr": 5,
  "ac": 15,
  "hp": 136,
  "hp_roll": "16d10+48",
  "str": 18,
  "dex": 8,
  "con": 16,
  "int": 5,
  "wis": 10,
  "cha": 5,
  "speed": 20,
  "skill_prof": [
   "stealth"
  ],
  "resist": [
   "fire",
   "cold"
  ],
  "immune": [
   "lightning"
  ],
  "vuln": [],
  "description": "Large plant, CR 5 (1800 XP)",
  "features": [
   "Lightning Absorption|Whenever the shambling mound is subjected to lightning damage, it takes no damage and regains a number of hit points equal to the lightning damage dealt."
  ]
 },
 "shield-guardian": {
  "cr": 7,
  "ac": 17,
  "hp": 142,
  "hp_roll": "15d10+60",
  "str": 18,
  "dex": 8,
  "con": 18,
  "int": 7,
  "wis": 10,
  "cha": 3,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "understands commands given in any language but can't speak"
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Large construct, CR 7 (2900 XP)",
  "features": [
   "Bound|The shield guardian is magically bound to an amulet. As long as the guardian and its amulet are on the same plane of existence, the amulet's wearer can telepathically call the guardian to travel to it, and the guardian knows the distance and direction to the amulet. If the guardian is within 60 feet of the amulet's wearer, half of any damage the wearer takes (rounded up) is transferred to the guardian.",
   "Regeneration|The shield guardian regains 10 hit points at the start of its turn if it has at least 1 hit. point.",
   "Spell Storing|A spellcaster who wears the shield guardian's amulet can cause the guardian to store one spell of 4th level or lower. To do so, the wearer must cast the spell on the guardian. The spell has no effect but is stored within the guardian. When commanded to do so by the wearer or when a situation arises that was predefined by the spellcaster, the guardian casts the stored spell with any parameters set by the original caster, requiring no components. When the spell is cast or a new spell is stored, any previously stored spell is lost."
  ]
 },
 "shrieker": {
  "cr": 0,
  "ac": 5,
  "hp": 13,
  "hp_roll": "3d8",
  "str": 1,
  "dex": 1,
  "con": 10,
  "int": 1,
  "wis": 3,
  "cha": 1,
  "speed": 0,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium plant, CR 0 (10 XP)",
  "features": [
   "False Appearance|While the shrieker remains motionless, it is indistinguishable from an ordinary fungus."
  ]
 },
 "silver-dragon-wyrmling": {
  "cr": 2,
  "ac": 17,
  "hp": 45,
  "hp_roll": "6d8+18",
  "str": 19,
  "dex": 10,
  "con": 17,
  "int": 12,
  "wis": 11,
  "cha": 15,
  "speed": 30,
  "darkvision": 60,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "cold"
  ],
  "vuln": [],
  "description": "Medium dragon, CR 2 (450 XP)"
 },
 "skeleton": {
  "cr": 0.25,
  "ac": 13,
  "hp": 13,
  "hp_roll": "2d8+4",
  "str": 10,
  "dex": 14,
  "con": 15,
  "int": 6,
  "wis": 8,
  "cha": 5,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "understands all languages it spoke in life but can't speak"
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [
   "bludgeoning"
  ],
  "description": "Medium undead, CR 0.25 (50 XP)"
 },
 "solar": {
  "cr": 21,
  "ac": 21,
  "hp": 243,
  "hp_roll": "18d10+144",
  "str": 26,
  "dex": 22,
  "con": 26,
  "int": 25,
  "wis": 25,
  "cha": 30,
  "speed": 50,
  "save_prof": [
   "int",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "all",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "radiant"
  ],
  "immune": [
   "poison",
   "necrotic"
  ],
  "vuln": [],
  "description": "Large celestial, CR 21 (33000 XP)",
  "features": [
   "Angelic Weapons|The solar's weapon attacks are magical. When the solar hits with any weapon, the weapon deals an extra 6d8 radiant damage (included in the attack).",
   "Divine Awareness|The solar knows if it hears a lie.",
   "Innate Spellcasting|The solar's spell casting ability is Charisma (spell save DC 25). It can innately cast the following spells, requiring no material components:",
   "Magic Resistance|The solar has advantage on saving throws against spells and other magical effects."
  ]
 },
 "specter": {
  "cr": 1,
  "ac": 12,
  "hp": 22,
  "hp_roll": "5d8",
  "str": 1,
  "dex": 14,
  "con": 11,
  "int": 10,
  "wis": 10,
  "cha": 11,
  "speed": 0,
  "darkvision": 60,
  "languages": [
   "understands all languages it knew in life but can't speak"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "fire",
   "cold",
   "acid",
   "lightning",
   "thunder"
  ],
  "immune": [
   "poison",
   "necrotic"
  ],
  "vuln": [],
  "description": "Medium undead, CR 1 (200 XP)",
  "features": [
   "Incorporeal Movement|The specter can move through other creatures and objects as if they were difficult terrain. It takes 5 (1d10) force damage if it ends its turn inside an object.",
   "Sunlight Sensitivity|While in sunlight, the specter has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight."
  ]
 },
 "spider": {
  "cr": 0,
  "ac": 12,
  "hp": 1,
  "hp_roll": "1d4-1",
  "str": 2,
  "dex": 14,
  "con": 8,
  "int": 1,
  "wis": 10,
  "cha": 2,
  "speed": 20,
  "darkvision": 30,
  "skill_prof": [
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0 (10 XP)",
  "features": [
   "Spider Climb|The spider can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.",
   "Web Sense|While in contact with a web, the spider knows the exact location of any other creature in contact with the same web.",
   "Web Walker|The spider ignores movement restrictions caused by webbing."
  ]
 },
 "spirit-naga": {
  "cr": 8,
  "ac": 15,
  "hp": 75,
  "hp_roll": "10d10+20",
  "str": 18,
  "dex": 17,
  "con": 14,
  "int": 16,
  "wis": 15,
  "cha": 16,
  "speed": 40,
  "darkvision": 60,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "languages": [
   "Abyssal",
   "Common"
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Large monstrosity, CR 8 (3900 XP)",
  "features": [
   "Rejuvenation|If it dies, the naga returns to life in 1d6 days and regains all its hit points. Only a wish spell can prevent this trait from functioning.",
   "Spellcasting|The naga is a 10th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 14, +6 to hit with spell attacks), and it needs only verbal components to cast its spells. It has the following wizard spells prepared:"
  ]
 },
 "sprite": {
  "cr": 0.25,
  "ac": 15,
  "hp": 2,
  "hp_roll": "1d4",
  "str": 3,
  "dex": 18,
  "con": 10,
  "int": 14,
  "wis": 13,
  "cha": 11,
  "speed": 10,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Elvish",
   "Sylvan"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny fey, CR 0.25 (50 XP)"
 },
 "spy": {
  "cr": 1,
  "ac": 12,
  "hp": 27,
  "hp_roll": "6d8",
  "str": 10,
  "dex": 15,
  "con": 10,
  "int": 12,
  "wis": 14,
  "cha": 16,
  "speed": 30,
  "skill_prof": [
   "deception",
   "insight",
   "investigation",
   "perception",
   "persuasion",
   "stealth"
  ],
  "languages": [
   "any two languages"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 1 (200 XP)",
  "features": [
   "Cunning Action|On each of its turns, the spy can use a bonus action to take the Dash, Disengage, or Hide action.",
   "Sneak Attack (1/Turn)|The spy deals an extra 7 (2d6) damage when it hits a target with a weapon attack and has advantage on the attack roll, or when the target is within 5 ft. of an ally of the spy that isn't incapacitated and the spy doesn't have disadvantage on the attack roll."
  ]
 },
 "steam-mephit": {
  "cr": 0.25,
  "ac": 10,
  "hp": 21,
  "hp_roll": "6d6",
  "str": 5,
  "dex": 11,
  "con": 10,
  "int": 11,
  "wis": 10,
  "cha": 12,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "Aquan",
   "Ignan"
  ],
  "resist": [],
  "immune": [
   "fire",
   "poison"
  ],
  "vuln": [],
  "description": "Small elemental, CR 0.25 (50 XP)",
  "features": [
   "Death Burst|When the mephit dies, it explodes in a cloud of steam. Each creature within 5 ft. of the mephit must succeed on a DC 10 Dexterity saving throw or take 4 (1d8) fire damage.",
   "Innate Spellcasting|The mephit can innately cast blur, requiring no material components. Its innate spellcasting ability is Charisma."
  ]
 },
 "stirge": {
  "cr": 0.125,
  "ac": 14,
  "hp": 2,
  "hp_roll": "1d4",
  "str": 4,
  "dex": 16,
  "con": 11,
  "int": 2,
  "wis": 8,
  "cha": 6,
  "speed": 10,
  "darkvision": 60,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0.125 (25 XP)"
 },
 "stone-giant": {
  "cr": 7,
  "ac": 17,
  "hp": 126,
  "hp_roll": "11d12+55",
  "str": 23,
  "dex": 15,
  "con": 20,
  "int": 10,
  "wis": 12,
  "cha": 9,
  "speed": 40,
  "darkvision": 60,
  "save_prof": [
   "dex",
   "con",
   "wis"
  ],
  "skill_prof": [
   "athletics",
   "perception"
  ],
  "languages": [
   "Giant"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Huge giant, CR 7 (2900 XP)",
  "features": [
   "Stone Camouflage|The giant has advantage on Dexterity (Stealth) checks made to hide in rocky terrain."
  ]
 },
 "stone-golem": {
  "cr": 10,
  "ac": 17,
  "hp": 178,
  "hp_roll": "17d10+85",
  "str": 22,
  "dex": 9,
  "con": 20,
  "int": 3,
  "wis": 11,
  "cha": 1,
  "speed": 30,
  "darkvision": 120,
  "languages": [
   "understands the languages of its creator but can't speak"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing",
   "poison",
   "psychic"
  ],
  "vuln": [],
  "description": "Large construct, CR 10 (5900 XP)",
  "features": [
   "Immutable Form|The golem is immune to any spell or effect that would alter its form.",
   "Magic Resistance|The golem has advantage on saving throws against spells and other magical effects.",
   "Magic Weapons|The golem's weapon attacks are magical."
  ]
 },
 "storm-giant": {
  "cr": 13,
  "ac": 16,
  "hp": 230,
  "hp_roll": "20d12+100",
  "str": 29,
  "dex": 14,
  "con": 20,
  "int": 16,
  "wis": 18,
  "cha": 18,
  "speed": 50,
  "save_prof": [
   "str",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "arcana",
   "athletics",
   "history",
   "perception"
  ],
  "languages": [
   "Common",
   "Giant"
  ],
  "resist": [
   "cold"
  ],
  "immune": [
   "lightning",
   "thunder"
  ],
  "vuln": [],
  "description": "Huge giant, CR 13 (10000 XP)",
  "features": [
   "Amphibious|The giant can breathe air and water.",
   "Innate Spellcasting|The giant's innate spellcasting ability is Charisma (spell save DC 17). It can innately cast the following spells, requiring no material components:"
  ]
 },
 "succubus-incubus": {
  "cr": 4,
  "ac": 15,
  "hp": 66,
  "hp_roll": "12d8+12",
  "str": 8,
  "dex": 17,
  "con": 13,
  "int": 15,
  "wis": 12,
  "cha": 20,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "deception",
   "insight",
   "perception",
   "persuasion",
   "stealth"
  ],
  "languages": [
   "Abyssal",
   "Common",
   "Infernal",
   "telepathy 60 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "fire",
   "cold",
   "poison",
   "lightning"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium fiend, CR 4 (1100 XP)",
  "features": [
   "Telepathic Bond|The fiend ignores the range restriction on its telepathy when communicating with a creature it has charmed. The two don't even need to be on the same plane of existence.",
   "Shapechanger|The fiend can use its action to polymorph into a Small or Medium humanoid, or back into its true form. Without wings, the fiend loses its flying speed. Other than its size and speed, its statistics are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies."
  ]
 },
 "swarm-of-bats": {
  "cr": 0.25,
  "ac": 12,
  "hp": 22,
  "hp_roll": "5d8",
  "str": 5,
  "dex": 15,
  "con": 10,
  "int": 2,
  "wis": 12,
  "cha": 4,
  "speed": 0,
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium swarm of Tiny beasts, CR 0.25 (50 XP)",
  "features": [
   "Echolocation|The swarm can't use its blindsight while deafened.",
   "Keen Hearing|The swarm has advantage on Wisdom (Perception) checks that rely on hearing.",
   "Swarm|The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny bat. The swarm can't regain hit points or gain temporary hit points."
  ]
 },
 "swarm-of-beetles": {
  "cr": 0.5,
  "ac": 12,
  "hp": 22,
  "hp_roll": "5d8",
  "str": 3,
  "dex": 13,
  "con": 10,
  "int": 1,
  "wis": 7,
  "cha": 1,
  "speed": 20,
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium swarm of Tiny beasts, CR 0.5 (100 XP)",
  "features": [
   "Swarm|The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny insect. The swarm can't regain hit points or gain temporary hit points."
  ]
 },
 "swarm-of-centipedes": {
  "cr": 0.5,
  "ac": 12,
  "hp": 22,
  "hp_roll": "5d8",
  "str": 3,
  "dex": 13,
  "con": 10,
  "int": 1,
  "wis": 7,
  "cha": 1,
  "speed": 20,
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium swarm of Tiny beasts, CR 0.5 (100 XP)",
  "features": [
   "Swarm|The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny insect. The swarm can't regain hit points or gain temporary hit points."
  ]
 },
 "swarm-of-insects": {
  "cr": 0.5,
  "ac": 12,
  "hp": 22,
  "hp_roll": "5d8",
  "str": 3,
  "dex": 13,
  "con": 10,
  "int": 1,
  "wis": 7,
  "cha": 1,
  "speed": 20,
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium swarm of Tiny beasts, CR 0.5 (100 XP)",
  "features": [
   "Swarm|The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny insect. The swarm can't regain hit points or gain temporary hit points."
  ]
 },
 "swarm-of-poisonous-snakes": {
  "cr": 2,
  "ac": 14,
  "hp": 36,
  "hp_roll": "8d8",
  "str": 8,
  "dex": 18,
  "con": 11,
  "int": 1,
  "wis": 10,
  "cha": 3,
  "speed": 30,
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium swarm of Tiny beasts, CR 2 (450 XP)",
  "features": [
   "Swarm|The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny snake. The swarm can't regain hit points or gain temporary hit points."
  ]
 },
 "swarm-of-quippers": {
  "cr": 1,
  "ac": 13,
  "hp": 28,
  "hp_roll": "8d8-8",
  "str": 13,
  "dex": 16,
  "con": 9,
  "int": 1,
  "wis": 7,
  "cha": 2,
  "speed": 0,
  "darkvision": 60,
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium swarm of Tiny beasts, CR 1 (200 XP)",
  "features": [
   "Blood Frenzy|The swarm has advantage on melee attack rolls against any creature that doesn't have all its hit points.",
   "Swarm|The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny quipper. The swarm can't regain hit points or gain temporary hit points.",
   "Water Breathing|The swarm can breathe only underwater."
  ]
 },
 "swarm-of-rats": {
  "cr": 0.25,
  "ac": 10,
  "hp": 24,
  "hp_roll": "7d8-7",
  "str": 9,
  "dex": 11,
  "con": 9,
  "int": 2,
  "wis": 10,
  "cha": 3,
  "speed": 30,
  "darkvision": 30,
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium swarm of Tiny beasts, CR 0.25 (50 XP)",
  "features": [
   "Keen Smell|The swarm has advantage on Wisdom (Perception) checks that rely on smell.",
   "Swarm|The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny rat. The swarm can't regain hit points or gain temporary hit points."
  ]
 },
 "swarm-of-ravens": {
  "cr": 0.25,
  "ac": 12,
  "hp": 24,
  "hp_roll": "7d8-7",
  "str": 6,
  "dex": 14,
  "con": 8,
  "int": 3,
  "wis": 12,
  "cha": 6,
  "speed": 10,
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium swarm of Tiny beasts, CR 0.25 (50 XP)",
  "features": [
   "Swarm|The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny raven. The swarm can't regain hit points or gain temporary hit points."
  ]
 },
 "swarm-of-spiders": {
  "cr": 0.5,
  "ac": 12,
  "hp": 22,
  "hp_roll": "5d8",
  "str": 3,
  "dex": 13,
  "con": 10,
  "int": 1,
  "wis": 7,
  "cha": 1,
  "speed": 20,
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium swarm of Tiny beasts, CR 0.5 (100 XP)",
  "features": [
   "Swarm|The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny insect. The swarm can't regain hit points or gain temporary hit points.",
   "Spider Climb|The swarm can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.",
   "Web Sense|While in contact with a web, the swarm knows the exact location of any other creature in contact with the same web.",
   "Web Walker|The swarm ignores movement restrictions caused by webbing."
  ]
 },
 "swarm-of-wasps": {
  "cr": 0.5,
  "ac": 12,
  "hp": 22,
  "hp_roll": "5d8",
  "str": 3,
  "dex": 13,
  "con": 10,
  "int": 1,
  "wis": 7,
  "cha": 1,
  "speed": 5,
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium swarm of Tiny beasts, CR 0.5 (100 XP)",
  "features": [
   "Swarm|The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny insect. The swarm can't regain hit points or gain temporary hit points."
  ]
 },
 "tarrasque": {
  "cr": 30,
  "ac": 25,
  "hp": 676,
  "hp_roll": "33d20+330",
  "str": 30,
  "dex": 11,
  "con": 30,
  "int": 3,
  "wis": 11,
  "cha": 11,
  "speed": 40,
  "save_prof": [
   "int",
   "wis",
   "cha"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing",
   "fire",
   "poison"
  ],
  "vuln": [],
  "description": "Gargantuan monstrosity, CR 30 (155000 XP)",
  "features": [
   "Legendary Resistance|If the tarrasque fails a saving throw, it can choose to succeed instead.",
   "Magic Resistance|The tarrasque has advantage on saving throws against spells and other magical effects.",
   "Reflective Carapace|Any time the tarrasque is targeted by a magic missile spell, a line spell, or a spell that requires a ranged attack roll, roll a d6. On a 1 to 5, the tarrasque is unaffected. On a 6, the tarrasque is unaffected, and the effect is reflected back at the caster as though it originated from the tarrasque, turning the caster into the target.",
   "Siege Monster|The tarrasque deals double damage to objects and structures."
  ]
 },
 "thug": {
  "cr": 0.5,
  "ac": 11,
  "hp": 32,
  "hp_roll": "5d8+10",
  "str": 15,
  "dex": 11,
  "con": 14,
  "int": 10,
  "wis": 10,
  "cha": 11,
  "speed": 30,
  "skill_prof": [
   "intimidation"
  ],
  "languages": [
   "any one language (usually Common)"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.5 (100 XP)",
  "features": [
   "Pack Tactics|The thug has advantage on an attack roll against a creature if at least one of the thug's allies is within 5 ft. of the creature and the ally isn't incapacitated."
  ]
 },
 "tiger": {
  "cr": 1,
  "ac": 12,
  "hp": 37,
  "hp_roll": "5d10+10",
  "str": 17,
  "dex": 15,
  "con": 14,
  "int": 3,
  "wis": 12,
  "cha": 8,
  "speed": 40,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 1 (200 XP)",
  "features": [
   "Keen Smell|The tiger has advantage on Wisdom (Perception) checks that rely on smell.",
   "Pounce|If the tiger moves at least 20 ft. straight toward a creature and then hits it with a claw attack on the same turn, that target must succeed on a DC 13 Strength saving throw or be knocked prone. If the target is prone, the tiger can make one bite attack against it as a bonus action."
  ]
 },
 "treant": {
  "cr": 9,
  "ac": 16,
  "hp": 138,
  "hp_roll": "12d12+60",
  "str": 23,
  "dex": 8,
  "con": 21,
  "int": 12,
  "wis": 16,
  "cha": 12,
  "speed": 30,
  "languages": [
   "Common",
   "Druidic",
   "Elvish",
   "Sylvan"
  ],
  "resist": [
   "piercing",
   "bludgeoning"
  ],
  "immune": [],
  "vuln": [
   "fire"
  ],
  "description": "Huge plant, CR 9 (5000 XP)",
  "features": [
   "False Appearance|While the treant remains motionless, it is indistinguishable from a normal tree.",
   "Siege Monster|The treant deals double damage to objects and structures."
  ]
 },
 "tribal-warrior": {
  "cr": 0.125,
  "ac": 12,
  "hp": 11,
  "hp_roll": "2d8+2",
  "str": 13,
  "dex": 11,
  "con": 12,
  "int": 8,
  "wis": 11,
  "cha": 8,
  "speed": 30,
  "languages": [
   "any one language"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 0.125 (25 XP)",
  "features": [
   "Pack Tactics|The warrior has advantage on an attack roll against a creature if at least one of the warrior's allies is within 5 ft. of the creature and the ally isn't incapacitated."
  ]
 },
 "triceratops": {
  "cr": 5,
  "ac": 13,
  "hp": 95,
  "hp_roll": "10d12+30",
  "str": 22,
  "dex": 9,
  "con": 17,
  "int": 2,
  "wis": 11,
  "cha": 5,
  "speed": 50,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Huge beast, CR 5 (1800 XP)",
  "features": [
   "Trampling Charge|If the triceratops moves at least 20 ft. straight toward a creature and then hits it with a gore attack on the same turn, that target must succeed on a DC 13 Strength saving throw or be knocked prone. If the target is prone, the triceratops can make one stomp attack against it as a bonus action."
  ]
 },
 "troll": {
  "cr": 5,
  "ac": 15,
  "hp": 84,
  "hp_roll": "8d10+40",
  "str": 18,
  "dex": 13,
  "con": 20,
  "int": 7,
  "wis": 9,
  "cha": 7,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "Giant"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large giant, CR 5 (1800 XP)",
  "features": [
   "Keen Smell|The troll has advantage on Wisdom (Perception) checks that rely on smell.",
   "Regeneration|The troll regains 10 hit points at the start of its turn. If the troll takes acid or fire damage, this trait doesn't function at the start of the troll's next turn. The troll dies only if it starts its turn with 0 hit points and doesn't regenerate."
  ]
 },
 "tyrannosaurus-rex": {
  "cr": 8,
  "ac": 13,
  "hp": 136,
  "hp_roll": "13d12+52",
  "str": 25,
  "dex": 10,
  "con": 19,
  "int": 2,
  "wis": 12,
  "cha": 9,
  "speed": 50,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Huge beast, CR 8 (3900 XP)"
 },
 "unicorn": {
  "cr": 5,
  "ac": 12,
  "hp": 67,
  "hp_roll": "9d10+18",
  "str": 18,
  "dex": 14,
  "con": 15,
  "int": 11,
  "wis": 17,
  "cha": 16,
  "speed": 50,
  "darkvision": 60,
  "languages": [
   "Celestial",
   "Elvish",
   "Sylvan",
   "telepathy 60 ft."
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Large celestial, CR 5 (1800 XP)",
  "features": [
   "Charge|If the unicorn moves at least 20 ft. straight toward a target and then hits it with a horn attack on the same turn, the target takes an extra 9 (2d8) piercing damage. If the target is a creature, it must succeed on a DC 15 Strength saving throw or be knocked prone.",
   "Innate Spellcasting|The unicorn's innate spellcasting ability is Charisma (spell save DC 14). The unicorn can innately cast the following spells, requiring no components:",
   "Magic Resistance|The unicorn has advantage on saving throws against spells and other magical effects.",
   "Magic Weapons|The unicorn's weapon attacks are magical."
  ]
 },
 "vampire-bat": {
  "cr": 13,
  "ac": 16,
  "hp": 144,
  "hp_roll": "17d8+68",
  "str": 18,
  "dex": 18,
  "con": 18,
  "int": 17,
  "wis": 15,
  "cha": 18,
  "speed": 5,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "the languages it knew in life"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "necrotic"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium undead, CR 13 (10000 XP)",
  "features": [
   "Shapechanger|If the vampire isn't in sun light or running water, it can use its action to polymorph into a Tiny bat or a Medium cloud of mist, or back into its true form.",
   "Legendary Resistance|If the vampire fails a saving throw, it can choose to succeed instead.",
   "Misty Escape|When it drops to 0 hit points outside its resting place, the vampire transforms into a cloud of mist (as in the Shapechanger trait) instead of falling unconscious, provided that it isn't in sunlight or running water. If it can't transform, it is destroyed.",
   "Regeneration|The vampire regains 20 hit points at the start of its turn if it has at least 1 hit point and isn't in sunlight or running water. If the vampire takes radiant damage or damage from holy water, this trait doesn't function at the start of the vampire's next turn.",
   "Spider Climb|The vampire can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.",
   "Vampire Weaknesses|The vampire has the following flaws:"
  ]
 },
 "vampire-mist": {
  "cr": 13,
  "ac": 16,
  "hp": 144,
  "hp_roll": "17d8+68",
  "str": 18,
  "dex": 18,
  "con": 18,
  "int": 17,
  "wis": 15,
  "cha": 18,
  "speed": 30,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "the languages it knew in life"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "necrotic"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium undead, CR 13 (10000 XP)",
  "features": [
   "Shapechanger|If the vampire isn't in sun light or running water, it can use its action to polymorph into a Tiny bat or a Medium cloud of mist, or back into its true form.",
   "Legendary Resistance|If the vampire fails a saving throw, it can choose to succeed instead.",
   "Misty Escape|When it drops to 0 hit points outside its resting place, the vampire transforms into a cloud of mist (as in the Shapechanger trait) instead of falling unconscious, provided that it isn't in sunlight or running water. If it can't transform, it is destroyed.",
   "Regeneration|The vampire regains 20 hit points at the start of its turn if it has at least 1 hit point and isn't in sunlight or running water. If the vampire takes radiant damage or damage from holy water, this trait doesn't function at the start of the vampire's next turn.",
   "Spider Climb|The vampire can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.",
   "Vampire Weaknesses|The vampire has the following flaws:"
  ]
 },
 "vampire-spawn": {
  "cr": 5,
  "ac": 15,
  "hp": 82,
  "hp_roll": "11d8+33",
  "str": 16,
  "dex": 16,
  "con": 16,
  "int": 11,
  "wis": 10,
  "cha": 12,
  "speed": 30,
  "darkvision": 60,
  "save_prof": [
   "dex",
   "wis"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "the languages it knew in life"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "necrotic"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium undead, CR 5 (1800 XP)",
  "features": [
   "Regeneration|The vampire regains 10 hit points at the start of its turn if it has at least 1 hit point and isn't in sunlight or running water. If the vampire takes radiant damage or damage from holy water, this trait doesn't function at the start of the vampire's next turn.",
   "Spider Climb|The vampire can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.",
   "Vampire Weaknesses|The vampire has the following flaws:"
  ]
 },
 "vampire-vampire": {
  "cr": 13,
  "ac": 16,
  "hp": 144,
  "hp_roll": "17d8+68",
  "str": 18,
  "dex": 18,
  "con": 18,
  "int": 17,
  "wis": 15,
  "cha": 18,
  "speed": 30,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "the languages it knew in life"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "necrotic"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium undead, CR 13 (10000 XP)",
  "features": [
   "Shapechanger|If the vampire isn't in sun light or running water, it can use its action to polymorph into a Tiny bat or a Medium cloud of mist, or back into its true form.",
   "Legendary Resistance|If the vampire fails a saving throw, it can choose to succeed instead.",
   "Misty Escape|When it drops to 0 hit points outside its resting place, the vampire transforms into a cloud of mist (as in the Shapechanger trait) instead of falling unconscious, provided that it isn't in sunlight or running water. If it can't transform, it is destroyed.",
   "Regeneration|The vampire regains 20 hit points at the start of its turn if it has at least 1 hit point and isn't in sunlight or running water. If the vampire takes radiant damage or damage from holy water, this trait doesn't function at the start of the vampire's next turn.",
   "Spider Climb|The vampire can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.",
   "Vampire Weaknesses|The vampire has the following flaws:"
  ]
 },
 "veteran": {
  "cr": 3,
  "ac": 17,
  "hp": 58,
  "hp_roll": "9d8+18",
  "str": 16,
  "dex": 13,
  "con": 14,
  "int": 10,
  "wis": 11,
  "cha": 10,
  "speed": 30,
  "skill_prof": [
   "athletics",
   "perception"
  ],
  "languages": [
   "any one language (usually Common)"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium humanoid, CR 3 (700 XP)"
 },
 "violet-fungus": {
  "cr": 0.25,
  "ac": 5,
  "hp": 18,
  "hp_roll": "4d8",
  "str": 3,
  "dex": 1,
  "con": 10,
  "int": 1,
  "wis": 3,
  "cha": 1,
  "speed": 5,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium plant, CR 0.25 (50 XP)",
  "features": [
   "False Appearance|While the violet fungus remains motionless, it is indistinguishable from an ordinary fungus."
  ]
 },
 "vrock": {
  "cr": 6,
  "ac": 15,
  "hp": 104,
  "hp_roll": "11d10+44",
  "str": 17,
  "dex": 15,
  "con": 18,
  "int": 8,
  "wis": 13,
  "cha": 8,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "wis",
   "cha"
  ],
  "languages": [
   "Abyssal",
   "telepathy 120 ft."
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "fire",
   "cold",
   "lightning"
  ],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Large fiend, CR 6 (2300 XP)",
  "features": [
   "Magic Resistance|The vrock has advantage on saving throws against spells and other magical effects."
  ]
 },
 "vulture": {
  "cr": 0,
  "ac": 10,
  "hp": 5,
  "hp_roll": "1d8+1",
  "str": 7,
  "dex": 10,
  "con": 13,
  "int": 2,
  "wis": 12,
  "cha": 4,
  "speed": 10,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0 (10 XP)",
  "features": [
   "Keen Sight and Smell|The vulture has advantage on Wisdom (Perception) checks that rely on sight or smell.",
   "Pack Tactics|The vulture has advantage on an attack roll against a creature if at least one of the vulture's allies is within 5 ft. of the creature and the ally isn't incapacitated."
  ]
 },
 "warhorse": {
  "cr": 0.5,
  "ac": 11,
  "hp": 19,
  "hp_roll": "3d10+3",
  "str": 18,
  "dex": 12,
  "con": 13,
  "int": 2,
  "wis": 12,
  "cha": 7,
  "speed": 60,
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large beast, CR 0.5 (100 XP)",
  "features": [
   "Trampling Charge|If the horse moves at least 20 ft. straight toward a creature and then hits it with a hooves attack on the same turn, that target must succeed on a DC 14 Strength saving throw or be knocked prone. If the target is prone, the horse can make another attack with its hooves against it as a bonus action."
  ]
 },
 "warhorse-skeleton": {
  "cr": 0.5,
  "ac": 13,
  "hp": 22,
  "hp_roll": "3d10+6",
  "str": 18,
  "dex": 12,
  "con": 15,
  "int": 2,
  "wis": 8,
  "cha": 5,
  "speed": 60,
  "darkvision": 60,
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [
   "bludgeoning"
  ],
  "description": "Large undead, CR 0.5 (100 XP)"
 },
 "water-elemental": {
  "cr": 5,
  "ac": 14,
  "hp": 114,
  "hp_roll": "12d10+48",
  "str": 18,
  "dex": 14,
  "con": 18,
  "int": 5,
  "wis": 10,
  "cha": 8,
  "speed": 30,
  "darkvision": 60,
  "languages": [
   "Aquan"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "acid"
  ],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Large elemental, CR 5 (1800 XP)",
  "features": [
   "Water Form|The elemental can enter a hostile creature's space and stop there. It can move through a space as narrow as 1 inch wide without squeezing.",
   "Freeze|If the elemental takes cold damage, it partially freezes; its speed is reduced by 20 ft. until the end of its next turn."
  ]
 },
 "weasel": {
  "cr": 0,
  "ac": 13,
  "hp": 1,
  "hp_roll": "1d4-1",
  "str": 3,
  "dex": 16,
  "con": 8,
  "int": 2,
  "wis": 12,
  "cha": 3,
  "speed": 30,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Tiny beast, CR 0 (10 XP)",
  "features": [
   "Keen Hearing and Smell|The weasel has advantage on Wisdom (Perception) checks that rely on hearing or smell."
  ]
 },
 "werebear-bear": {
  "cr": 5,
  "ac": 11,
  "hp": 135,
  "hp_roll": "18d8+54",
  "str": 19,
  "dex": 10,
  "con": 17,
  "int": 11,
  "wis": 12,
  "cha": 12,
  "speed": 40,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [],
  "description": "Medium humanoid, CR 5 (1800 XP)",
  "features": [
   "Shapechanger|The werebear can use its action to polymorph into a Large bear-humanoid hybrid or into a Large bear, or back into its true form, which is humanoid. Its statistics, other than its size and AC, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Keen Smell|The werebear has advantage on Wisdom (Perception) checks that rely on smell."
  ]
 },
 "werebear-human": {
  "cr": 5,
  "ac": 10,
  "hp": 135,
  "hp_roll": "18d8+54",
  "str": 19,
  "dex": 10,
  "con": 17,
  "int": 11,
  "wis": 12,
  "cha": 12,
  "speed": 30,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "Common"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [],
  "description": "Medium humanoid, CR 5 (1800 XP)",
  "features": [
   "Shapechanger|The werebear can use its action to polymorph into a Large bear-humanoid hybrid or into a Large bear, or back into its true form, which is humanoid. Its statistics, other than its size and AC, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Keen Smell|The werebear has advantage on Wisdom (Perception) checks that rely on smell."
  ]
 },
 "werebear-hybrid": {
  "cr": 5,
  "ac": 11,
  "hp": 135,
  "hp_roll": "18d8+54",
  "str": 19,
  "dex": 10,
  "con": 17,
  "int": 11,
  "wis": 12,
  "cha": 12,
  "speed": 40,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "Common"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [],
  "description": "Medium humanoid, CR 5 (1800 XP)",
  "features": [
   "Shapechanger|The werebear can use its action to polymorph into a Large bear-humanoid hybrid or into a Large bear, or back into its true form, which is humanoid. Its statistics, other than its size and AC, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Keen Smell|The werebear has advantage on Wisdom (Perception) checks that rely on smell."
  ]
 },
 "wereboar-boar": {
  "cr": 4,
  "ac": 11,
  "hp": 78,
  "hp_roll": "12d8+24",
  "str": 17,
  "dex": 10,
  "con": 15,
  "int": 10,
  "wis": 11,
  "cha": 8,
  "speed": 40,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [],
  "description": "Medium humanoid, CR 4 (1100 XP)",
  "features": [
   "Shapechanger|The wereboar can use its action to polymorph into a boar-humanoid hybrid or into a boar, or back into its true form, which is humanoid. Its statistics, other than its AC, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Charge (Boar or Hybrid Form Only)|If the wereboar moves at least 15 feet straight toward a target and then hits it with its tusks on the same turn, the target takes an extra 7 (2d6) slashing damage. If the target is a creature, it must succeed on a DC 13 Strength saving throw or be knocked prone.",
   "Relentless|If the wereboar takes 14 damage or less that would reduce it to 0 hit points, it is reduced to 1 hit point instead."
  ]
 },
 "wereboar-human": {
  "cr": 4,
  "ac": 10,
  "hp": 78,
  "hp_roll": "12d8+24",
  "str": 17,
  "dex": 10,
  "con": 15,
  "int": 10,
  "wis": 11,
  "cha": 8,
  "speed": 30,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "Common (can't speak in boar form)"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [],
  "description": "Medium humanoid, CR 4 (1100 XP)",
  "features": [
   "Shapechanger|The wereboar can use its action to polymorph into a boar-humanoid hybrid or into a boar, or back into its true form, which is humanoid. Its statistics, other than its AC, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Relentless|If the wereboar takes 14 damage or less that would reduce it to 0 hit points, it is reduced to 1 hit point instead."
  ]
 },
 "wereboar-hybrid": {
  "cr": 4,
  "ac": 11,
  "hp": 78,
  "hp_roll": "12d8+24",
  "str": 17,
  "dex": 10,
  "con": 15,
  "int": 10,
  "wis": 11,
  "cha": 8,
  "speed": 30,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "Common"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [],
  "description": "Medium humanoid, CR 4 (1100 XP)",
  "features": [
   "Shapechanger|The wereboar can use its action to polymorph into a boar-humanoid hybrid or into a boar, or back into its true form, which is humanoid. Its statistics, other than its AC, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Charge (Boar or Hybrid Form Only)|If the wereboar moves at least 15 feet straight toward a target and then hits it with its tusks on the same turn, the target takes an extra 7 (2d6) slashing damage. If the target is a creature, it must succeed on a DC 13 Strength saving throw or be knocked prone.",
   "Relentless|If the wereboar takes 14 damage or less that would reduce it to 0 hit points, it is reduced to 1 hit point instead."
  ]
 },
 "wererat-human": {
  "cr": 2,
  "ac": 12,
  "hp": 33,
  "hp_roll": "6d8+6",
  "str": 10,
  "dex": 15,
  "con": 12,
  "int": 11,
  "wis": 10,
  "cha": 8,
  "speed": 30,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [],
  "description": "Medium humanoid, CR 2 (450 XP)",
  "features": [
   "Shapechanger|The wererat can use its action to polymorph into a rat-humanoid hybrid or into a giant rat, or back into its true form, which is humanoid. Its statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Keen Smell|The wererat has advantage on Wisdom (Perception) checks that rely on smell."
  ]
 },
 "wererat-hybrid": {
  "cr": 2,
  "ac": 12,
  "hp": 33,
  "hp_roll": "6d8+6",
  "str": 10,
  "dex": 15,
  "con": 12,
  "int": 11,
  "wis": 10,
  "cha": 8,
  "speed": 30,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [],
  "description": "Medium humanoid, CR 2 (450 XP)",
  "features": [
   "Shapechanger|The wererat can use its action to polymorph into a rat-humanoid hybrid or into a giant rat, or back into its true form, which is humanoid. Its statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Keen Smell|The wererat has advantage on Wisdom (Perception) checks that rely on smell."
  ]
 },
 "wererat-rat": {
  "cr": 2,
  "ac": 12,
  "hp": 33,
  "hp_roll": "6d8+6",
  "str": 10,
  "dex": 15,
  "con": 12,
  "int": 11,
  "wis": 10,
  "cha": 8,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [],
  "description": "Medium humanoid, CR 2 (450 XP)",
  "features": [
   "Shapechanger|The wererat can use its action to polymorph into a rat-humanoid hybrid or into a giant rat, or back into its true form, which is humanoid. Its statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Keen Smell|The wererat has advantage on Wisdom (Perception) checks that rely on smell."
  ]
 },
 "weretiger-human": {
  "cr": 4,
  "ac": 12,
  "hp": 120,
  "hp_roll": "16d8+48",
  "str": 17,
  "dex": 15,
  "con": 16,
  "int": 10,
  "wis": 13,
  "cha": 11,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [],
  "description": "Medium humanoid, CR 4 (1100 XP)",
  "features": [
   "Shapechanger|The weretiger can use its action to polymorph into a tiger-humanoid hybrid or into a tiger, or back into its true form, which is humanoid. Its statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Keen Hearing and Smell|The weretiger has advantage on Wisdom (Perception) checks that rely on hearing or smell."
  ]
 },
 "weretiger-hybrid": {
  "cr": 4,
  "ac": 12,
  "hp": 120,
  "hp_roll": "16d8+48",
  "str": 17,
  "dex": 15,
  "con": 16,
  "int": 10,
  "wis": 13,
  "cha": 11,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [],
  "description": "Medium humanoid, CR 4 (1100 XP)",
  "features": [
   "Shapechanger|The weretiger can use its action to polymorph into a tiger-humanoid hybrid or into a tiger, or back into its true form, which is humanoid. Its statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Keen Hearing and Smell|The weretiger has advantage on Wisdom (Perception) checks that rely on hearing or smell.",
   "Pounce|If the weretiger moves at least 15 feet straight toward a creature and then hits it with a claw attack on the same turn, that target must succeed on a DC 14 Strength saving throw or be knocked prone. If the target is prone, the weretiger can make one bite attack against it as a bonus action."
  ]
 },
 "weretiger-tiger": {
  "cr": 4,
  "ac": 12,
  "hp": 120,
  "hp_roll": "16d8+48",
  "str": 17,
  "dex": 15,
  "con": 16,
  "int": 10,
  "wis": 13,
  "cha": 11,
  "speed": 40,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [],
  "description": "Medium humanoid, CR 4 (1100 XP)",
  "features": [
   "Shapechanger|The weretiger can use its action to polymorph into a tiger-humanoid hybrid or into a tiger, or back into its true form, which is humanoid. Its statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Keen Hearing and Smell|The weretiger has advantage on Wisdom (Perception) checks that rely on hearing or smell.",
   "Pounce|If the weretiger moves at least 15 feet straight toward a creature and then hits it with a claw attack on the same turn, that target must succeed on a DC 14 Strength saving throw or be knocked prone. If the target is prone, the weretiger can make one bite attack against it as a bonus action."
  ]
 },
 "werewolf-human": {
  "cr": 3,
  "ac": 11,
  "hp": 58,
  "hp_roll": "9d8+18",
  "str": 15,
  "dex": 13,
  "con": 14,
  "int": 10,
  "wis": 11,
  "cha": 10,
  "speed": 30,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "Common"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [],
  "description": "Medium humanoid, CR 3 (700 XP)",
  "features": [
   "Shapechanger|The werewolf can use its action to polymorph into a wolf-humanoid hybrid or into a wolf, or back into its true form, which is humanoid. Its statistics, other than its AC, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Keen Hearing and Smell|The werewolf has advantage on Wisdom (Perception) checks that rely on hearing or smell."
  ]
 },
 "werewolf-hybrid": {
  "cr": 3,
  "ac": 12,
  "hp": 58,
  "hp_roll": "9d8+18",
  "str": 15,
  "dex": 13,
  "con": 14,
  "int": 10,
  "wis": 11,
  "cha": 10,
  "speed": 30,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "Common"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [],
  "description": "Medium humanoid, CR 3 (700 XP)",
  "features": [
   "Shapechanger|The werewolf can use its action to polymorph into a wolf-humanoid hybrid or into a wolf, or back into its true form, which is humanoid. Its statistics, other than its AC, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Keen Hearing and Smell|The werewolf has advantage on Wisdom (Perception) checks that rely on hearing or smell."
  ]
 },
 "werewolf-wolf": {
  "cr": 3,
  "ac": 12,
  "hp": 58,
  "hp_roll": "9d8+18",
  "str": 15,
  "dex": 13,
  "con": 14,
  "int": 10,
  "wis": 11,
  "cha": 10,
  "speed": 40,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [
   "piercing",
   "bludgeoning",
   "slashing"
  ],
  "vuln": [],
  "description": "Medium humanoid, CR 3 (700 XP)",
  "features": [
   "Shapechanger|The werewolf can use its action to polymorph into a wolf-humanoid hybrid or into a wolf, or back into its true form, which is humanoid. Its statistics, other than its AC, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
   "Keen Hearing and Smell|The werewolf has advantage on Wisdom (Perception) checks that rely on hearing or smell."
  ]
 },
 "white-dragon-wyrmling": {
  "cr": 2,
  "ac": 16,
  "hp": 32,
  "hp_roll": "5d8+10",
  "str": 14,
  "dex": 10,
  "con": 14,
  "int": 5,
  "wis": 10,
  "cha": 11,
  "speed": 30,
  "darkvision": 60,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "cold"
  ],
  "vuln": [],
  "description": "Medium dragon, CR 2 (450 XP)"
 },
 "wight": {
  "cr": 3,
  "ac": 14,
  "hp": 45,
  "hp_roll": "6d8+18",
  "str": 15,
  "dex": 14,
  "con": 16,
  "int": 10,
  "wis": 13,
  "cha": 15,
  "speed": 30,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "the languages it knew in life"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "necrotic"
  ],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Medium undead, CR 3 (700 XP)",
  "features": [
   "Sunlight Sensitivity|While in sunlight, the wight has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight."
  ]
 },
 "will-o-wisp": {
  "cr": 2,
  "ac": 19,
  "hp": 22,
  "hp_roll": "9d4",
  "str": 1,
  "dex": 28,
  "con": 10,
  "int": 13,
  "wis": 14,
  "cha": 11,
  "speed": 0,
  "darkvision": 120,
  "languages": [
   "the languages it knew in life"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "fire",
   "cold",
   "acid",
   "thunder",
   "necrotic"
  ],
  "immune": [
   "poison",
   "lightning"
  ],
  "vuln": [],
  "description": "Tiny undead, CR 2 (450 XP)",
  "features": [
   "Consume Life|As a bonus action, the will-o'-wisp can target one creature it can see within 5 ft. of it that has 0 hit points and is still alive. The target must succeed on a DC 10 Constitution saving throw against this magic or die. If the target dies, the will-o'-wisp regains 10 (3d6) hit points.",
   "Ephemeral|The will-o'-wisp can't wear or carry anything.",
   "Incorporeal Movement|The will-o'-wisp can move through other creatures and objects as if they were difficult terrain. It takes 5 (1d10) force damage if it ends its turn inside an object.",
   "Variable Illumination|The will-o'-wisp sheds bright light in a 5- to 20-foot radius and dim light for an additional number of ft. equal to the chosen radius. The will-o'-wisp can alter the radius as a bonus action."
  ]
 },
 "winter-wolf": {
  "cr": 3,
  "ac": 13,
  "hp": 75,
  "hp_roll": "10d10+20",
  "str": 18,
  "dex": 13,
  "con": 14,
  "int": 7,
  "wis": 12,
  "cha": 8,
  "speed": 50,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Giant",
   "Winter Wolf"
  ],
  "resist": [],
  "immune": [
   "cold"
  ],
  "vuln": [],
  "description": "Large monstrosity, CR 3 (700 XP)",
  "features": [
   "Keen Hearing and Smell|The wolf has advantage on Wisdom (Perception) checks that rely on hearing or smell.",
   "Pack Tactics|The wolf has advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 ft. of the creature and the ally isn't incapacitated.",
   "Snow Camouflage|The wolf has advantage on Dexterity (Stealth) checks made to hide in snowy terrain."
  ]
 },
 "wolf": {
  "cr": 0.25,
  "ac": 13,
  "hp": 11,
  "hp_roll": "2d8+2",
  "str": 12,
  "dex": 15,
  "con": 12,
  "int": 3,
  "wis": 12,
  "cha": 6,
  "speed": 40,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Medium beast, CR 0.25 (50 XP)",
  "features": [
   "Keen Hearing and Smell|The wolf has advantage on Wisdom (Perception) checks that rely on hearing or smell.",
   "Pack Tactics|The wolf has advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 ft. of the creature and the ally isn't incapacitated."
  ]
 },
 "worg": {
  "cr": 0.5,
  "ac": 13,
  "hp": 26,
  "hp_roll": "4d10+4",
  "str": 16,
  "dex": 13,
  "con": 13,
  "int": 7,
  "wis": 11,
  "cha": 8,
  "speed": 50,
  "darkvision": 60,
  "skill_prof": [
   "perception"
  ],
  "languages": [
   "Goblin",
   "Worg"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large monstrosity, CR 0.5 (100 XP)",
  "features": [
   "Keen Hearing and Smell|The worg has advantage on Wisdom (Perception) checks that rely on hearing or smell."
  ]
 },
 "wraith": {
  "cr": 5,
  "ac": 13,
  "hp": 67,
  "hp_roll": "9d8+27",
  "str": 6,
  "dex": 16,
  "con": 16,
  "int": 12,
  "wis": 14,
  "cha": 15,
  "speed": 0,
  "darkvision": 60,
  "languages": [
   "the languages it knew in life"
  ],
  "resist": [
   "piercing",
   "bludgeoning",
   "slashing",
   "fire",
   "cold",
   "acid",
   "lightning",
   "thunder"
  ],
  "immune": [
   "poison",
   "necrotic"
  ],
  "vuln": [],
  "description": "Medium undead, CR 5 (1800 XP)",
  "features": [
   "Incorporeal Movement|The wraith can move through other creatures and objects as if they were difficult terrain. It takes 5 (1d10) force damage if it ends its turn inside an object.",
   "Sunlight Sensitivity|While in sunlight, the wraith has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight."
  ]
 },
 "wyvern": {
  "cr": 6,
  "ac": 13,
  "hp": 110,
  "hp_roll": "13d10+39",
  "str": 19,
  "dex": 10,
  "con": 16,
  "int": 5,
  "wis": 12,
  "cha": 6,
  "speed": 20,
  "darkvision": 60,
  "skill_prof": [
   "perception"
  ],
  "resist": [],
  "immune": [],
  "vuln": [],
  "description": "Large dragon, CR 6 (2300 XP)"
 },
 "xorn": {
  "cr": 5,
  "ac": 19,
  "hp": 73,
  "hp_roll": "7d8+42",
  "str": 17,
  "dex": 10,
  "con": 22,
  "int": 11,
  "wis": 10,
  "cha": 11,
  "speed": 20,
  "darkvision": 60,
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Terran"
  ],
  "resist": [
   "piercing",
   "slashing"
  ],
  "immune": [],
  "vuln": [],
  "description": "Medium elemental, CR 5 (1800 XP)",
  "features": [
   "Earth Glide|The xorn can burrow through nonmagical, unworked earth and stone. While doing so, the xorn doesn't disturb the material it moves through.",
   "Stone Camouflage|The xorn has advantage on Dexterity (Stealth) checks made to hide in rocky terrain.",
   "Treasure Sense|The xorn can pinpoint, by scent, the location of precious metals and stones, such as coins and gems, within 60 ft. of it."
  ]
 },
 "young-black-dragon": {
  "cr": 7,
  "ac": 18,
  "hp": 127,
  "hp_roll": "15d10+45",
  "str": 19,
  "dex": 14,
  "con": 17,
  "int": 12,
  "wis": 11,
  "cha": 15,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "acid"
  ],
  "vuln": [],
  "description": "Large dragon, CR 7 (2900 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water."
  ]
 },
 "young-blue-dragon": {
  "cr": 9,
  "ac": 18,
  "hp": 152,
  "hp_roll": "16d10+64",
  "str": 21,
  "dex": 10,
  "con": 19,
  "int": 14,
  "wis": 13,
  "cha": 17,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "lightning"
  ],
  "vuln": [],
  "description": "Large dragon, CR 9 (5000 XP)"
 },
 "young-brass-dragon": {
  "cr": 6,
  "ac": 17,
  "hp": 110,
  "hp_roll": "13d10+39",
  "str": 19,
  "dex": 10,
  "con": 17,
  "int": 12,
  "wis": 11,
  "cha": 15,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "persuasion",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Large dragon, CR 6 (2300 XP)"
 },
 "young-bronze-dragon": {
  "cr": 8,
  "ac": 18,
  "hp": 142,
  "hp_roll": "15d10+60",
  "str": 21,
  "dex": 10,
  "con": 19,
  "int": 14,
  "wis": 13,
  "cha": 17,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "insight",
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "lightning"
  ],
  "vuln": [],
  "description": "Large dragon, CR 8 (3900 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water."
  ]
 },
 "young-copper-dragon": {
  "cr": 7,
  "ac": 17,
  "hp": 119,
  "hp_roll": "14d10+42",
  "str": 19,
  "dex": 12,
  "con": 17,
  "int": 16,
  "wis": 13,
  "cha": 15,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "deception",
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "acid"
  ],
  "vuln": [],
  "description": "Large dragon, CR 7 (2900 XP)"
 },
 "young-gold-dragon": {
  "cr": 10,
  "ac": 18,
  "hp": 178,
  "hp_roll": "17d10+85",
  "str": 23,
  "dex": 14,
  "con": 21,
  "int": 16,
  "wis": 13,
  "cha": 20,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "insight",
   "perception",
   "persuasion",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Large dragon, CR 10 (5900 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water."
  ]
 },
 "young-green-dragon": {
  "cr": 8,
  "ac": 18,
  "hp": 136,
  "hp_roll": "16d10+48",
  "str": 19,
  "dex": 12,
  "con": 17,
  "int": 16,
  "wis": 13,
  "cha": 15,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "deception",
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Large dragon, CR 8 (3900 XP)",
  "features": [
   "Amphibious|The dragon can breathe air and water."
  ]
 },
 "young-red-dragon": {
  "cr": 10,
  "ac": 18,
  "hp": 178,
  "hp_roll": "17d10+85",
  "str": 23,
  "dex": 10,
  "con": 21,
  "int": 14,
  "wis": 11,
  "cha": 19,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "fire"
  ],
  "vuln": [],
  "description": "Large dragon, CR 10 (5900 XP)"
 },
 "young-silver-dragon": {
  "cr": 9,
  "ac": 18,
  "hp": 168,
  "hp_roll": "16d10+80",
  "str": 23,
  "dex": 10,
  "con": 21,
  "int": 14,
  "wis": 11,
  "cha": 19,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "arcana",
   "history",
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "cold"
  ],
  "vuln": [],
  "description": "Large dragon, CR 9 (5000 XP)"
 },
 "young-white-dragon": {
  "cr": 6,
  "ac": 17,
  "hp": 133,
  "hp_roll": "14d10+56",
  "str": 18,
  "dex": 10,
  "con": 18,
  "int": 6,
  "wis": 11,
  "cha": 12,
  "speed": 40,
  "darkvision": 120,
  "save_prof": [
   "dex",
   "con",
   "wis",
   "cha"
  ],
  "skill_prof": [
   "perception",
   "stealth"
  ],
  "languages": [
   "Common",
   "Draconic"
  ],
  "resist": [],
  "immune": [
   "cold"
  ],
  "vuln": [],
  "description": "Large dragon, CR 6 (2300 XP)",
  "features": [
   "Ice Walk|The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, difficult terrain composed of ice or snow doesn't cost it extra movement."
  ]
 },
 "zombie": {
  "cr": 0.25,
  "ac": 8,
  "hp": 22,
  "hp_roll": "3d8+9",
  "str": 13,
  "dex": 6,
  "con": 16,
  "int": 3,
  "wis": 6,
  "cha": 5,
  "speed": 20,
  "darkvision": 60,
  "save_prof": [
   "wis"
  ],
  "languages": [
   "understands all languages it spoke in life but can't speak"
  ],
  "resist": [],
  "immune": [
   "poison"
  ],
  "vuln": [],
  "description": "Medium undead, CR 0.25 (50 XP)",
  "features": [
   "Undead Fortitude|If damage reduces the zombie to 0 hit points, it must make a Constitution saving throw with a DC of 5+the damage taken, unless the damage is radiant or from a critical hit. On a success, the zombie drops to 1 hit point instead."
  ]
 }
}
