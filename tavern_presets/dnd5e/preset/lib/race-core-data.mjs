// race-core-data.mjs — 9 种族面(2026-09-30 由 scripts/extract-race-core.mjs 抽取;
// assemble 重跑后重抽)。opening/spawn_npc 零 lorebook 读取——断档回退=readFM 原路径。勿手改,重抽覆盖。
export const RACE_CORE = {
 "dragonborn": {
  "fm": {
   "name": "Dragonborn",
   "description": "speed 30 ft. · STR +2, CHA +1",
   "speed": 30,
   "ability_bonuses": "STR +2, CHA +1"
  }
 },
 "dwarf": {
  "fm": {
   "name": "Dwarf",
   "description": "speed 25 ft. · CON +2",
   "speed": 25,
   "ability_bonuses": "CON +2"
  }
 },
 "elf": {
  "fm": {
   "name": "Elf",
   "description": "speed 30 ft. · DEX +2",
   "speed": 30,
   "ability_bonuses": "DEX +2"
  }
 },
 "gnome": {
  "fm": {
   "name": "Gnome",
   "description": "speed 25 ft. · INT +2",
   "speed": 25,
   "ability_bonuses": "INT +2"
  }
 },
 "half-elf": {
  "fm": {
   "name": "Half-Elf",
   "description": "speed 30 ft. · CHA +2",
   "speed": 30,
   "ability_bonuses": "CHA +2"
  }
 },
 "half-orc": {
  "fm": {
   "name": "Half-Orc",
   "description": "speed 30 ft. · STR +2, CON +1",
   "speed": 30,
   "ability_bonuses": "STR +2, CON +1"
  }
 },
 "halfling": {
  "fm": {
   "name": "Halfling",
   "description": "speed 25 ft. · DEX +2",
   "speed": 25,
   "ability_bonuses": "DEX +2"
  }
 },
 "human": {
  "fm": {
   "name": "Human",
   "description": "speed 30 ft. · STR +1, DEX +1, CON +1, INT +1, WIS +1, CHA +1",
   "speed": 30,
   "ability_bonuses": "STR +1, DEX +1, CON +1, INT +1, WIS +1, CHA +1"
  }
 },
 "tiefling": {
  "fm": {
   "name": "Tiefling",
   "description": "speed 30 ft. · INT +1, CHA +2",
   "speed": 30,
   "ability_bonuses": "INT +1, CHA +2"
  }
 }
}
