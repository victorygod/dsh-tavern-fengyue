// class-core-data.mjs — 12 职业面(2026-09-30 由 scripts/extract-class-core.mjs 抽取;
// assemble 重跑后重抽)。buildClass/classRow 升级链/opening 零 lorebook 读取——断档回退=md 原路径。
// rows[0..19]=L1..L20(逐级行,pb/features/specific——specific 已 JSON 化)。勿手改,重抽覆盖。
export const CLASS_CORE = {
 "barbarian": {
  "fm": {
   "name": "Barbarian",
   "description": "Barbarian: d12 HD, saves STR/CON",
   "hit_die": 12,
   "saves": [
    "STR",
    "CON"
   ],
   "subclass": [
    "Berserker"
   ]
  },
  "prof_line": "Choose two from Animal Handling, Athletics, Intimidation, Nature, Perception, and Survival",
  "rows": [
   {
    "pb": 2,
    "features": "Rage, Unarmored Defense",
    "specific": {
     "rage_count": 2,
     "rage_damage_bonus": 2,
     "brutal_critical_dice": 0
    }
   },
   {
    "pb": 2,
    "features": "Reckless Attack, Danger Sense",
    "specific": {
     "rage_count": 2,
     "rage_damage_bonus": 2,
     "brutal_critical_dice": 0
    }
   },
   {
    "pb": 2,
    "features": "Primal Path",
    "specific": {
     "rage_count": 3,
     "rage_damage_bonus": 2,
     "brutal_critical_dice": 0
    }
   },
   {
    "pb": 2,
    "features": "Ability Score Improvement",
    "specific": {
     "rage_count": 3,
     "rage_damage_bonus": 2,
     "brutal_critical_dice": 0
    }
   },
   {
    "pb": 3,
    "features": "Extra Attack, Fast Movement",
    "specific": {
     "rage_count": 3,
     "rage_damage_bonus": 2,
     "brutal_critical_dice": 0
    }
   },
   {
    "pb": 3,
    "features": "Path feature",
    "specific": {
     "rage_count": 4,
     "rage_damage_bonus": 2,
     "brutal_critical_dice": 0
    }
   },
   {
    "pb": 3,
    "features": "Feral Instinct",
    "specific": {
     "rage_count": 4,
     "rage_damage_bonus": 2,
     "brutal_critical_dice": 0
    }
   },
   {
    "pb": 3,
    "features": "Ability Score Improvement",
    "specific": {
     "rage_count": 4,
     "rage_damage_bonus": 2,
     "brutal_critical_dice": 0
    }
   },
   {
    "pb": 4,
    "features": "Brutal Critical (1 die)",
    "specific": {
     "rage_count": 4,
     "rage_damage_bonus": 3,
     "brutal_critical_dice": 1
    }
   },
   {
    "pb": 4,
    "features": "Path feature",
    "specific": {
     "rage_count": 4,
     "rage_damage_bonus": 3,
     "brutal_critical_dice": 1
    }
   },
   {
    "pb": 4,
    "features": "Relentless Rage",
    "specific": {
     "rage_count": 4,
     "rage_damage_bonus": 3,
     "brutal_critical_dice": 1
    }
   },
   {
    "pb": 4,
    "features": "Ability Score Improvement",
    "specific": {
     "rage_count": 5,
     "rage_damage_bonus": 3,
     "brutal_critical_dice": 1
    }
   },
   {
    "pb": 5,
    "features": "Brutal Critical (2 dice)",
    "specific": {
     "rage_count": 5,
     "rage_damage_bonus": 3,
     "brutal_critical_dice": 2
    }
   },
   {
    "pb": 5,
    "features": "Path feature",
    "specific": {
     "rage_count": 5,
     "rage_damage_bonus": 3,
     "brutal_critical_dice": 2
    }
   },
   {
    "pb": 5,
    "features": "Persistent Rage",
    "specific": {
     "rage_count": 5,
     "rage_damage_bonus": 3,
     "brutal_critical_dice": 2
    }
   },
   {
    "pb": 5,
    "features": "Ability Score Improvement",
    "specific": {
     "rage_count": 5,
     "rage_damage_bonus": 4,
     "brutal_critical_dice": 2
    }
   },
   {
    "pb": 6,
    "features": "Brutal Critical (3 dice)",
    "specific": {
     "rage_count": 6,
     "rage_damage_bonus": 4,
     "brutal_critical_dice": 3
    }
   },
   {
    "pb": 6,
    "features": "Indomitable Might",
    "specific": {
     "rage_count": 6,
     "rage_damage_bonus": 4,
     "brutal_critical_dice": 3
    }
   },
   {
    "pb": 6,
    "features": "Ability Score Improvement",
    "specific": {
     "rage_count": 6,
     "rage_damage_bonus": 4,
     "brutal_critical_dice": 3
    }
   },
   {
    "pb": 6,
    "features": "Primal Champion",
    "specific": {
     "rage_count": 9999,
     "rage_damage_bonus": 4,
     "brutal_critical_dice": 3
    }
   }
  ]
 },
 "bard": {
  "fm": {
   "name": "Bard",
   "description": "Bard: d8 HD, saves DEX/CHA",
   "hit_die": 8,
   "saves": [
    "DEX",
    "CHA"
   ],
   "subclass": [
    "Lore"
   ]
  },
  "prof_line": "Choose any three",
  "rows": [
   {
    "pb": 2,
    "features": "Spellcasting: Bard, Bardic Inspiration (d6)",
    "specific": {
     "bardic_inspiration_die": 6,
     "song_of_rest_die": 0,
     "magical_secrets_max_5": 0,
     "magical_secrets_max_7": 0,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 2,
    "features": "Jack of All Trades, Song of Rest (d6)",
    "specific": {
     "bardic_inspiration_die": 6,
     "song_of_rest_die": 6,
     "magical_secrets_max_5": 0,
     "magical_secrets_max_7": 0,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 2,
    "features": "Expertise, Bard College",
    "specific": {
     "bardic_inspiration_die": 6,
     "song_of_rest_die": 6,
     "magical_secrets_max_5": 0,
     "magical_secrets_max_7": 0,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 2,
    "features": "Ability Score Improvement",
    "specific": {
     "bardic_inspiration_die": 6,
     "song_of_rest_die": 6,
     "magical_secrets_max_5": 0,
     "magical_secrets_max_7": 0,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 3,
    "features": "Bardic Inspiration (d8), Font of Inspiration",
    "specific": {
     "bardic_inspiration_die": 8,
     "song_of_rest_die": 6,
     "magical_secrets_max_5": 0,
     "magical_secrets_max_7": 0,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 3,
    "features": "Countercharm, Bard College feature",
    "specific": {
     "bardic_inspiration_die": 8,
     "song_of_rest_die": 6,
     "magical_secrets_max_5": 0,
     "magical_secrets_max_7": 0,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 3,
    "features": "—",
    "specific": {
     "bardic_inspiration_die": 8,
     "song_of_rest_die": 6,
     "magical_secrets_max_5": 0,
     "magical_secrets_max_7": 0,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 3,
    "features": "Ability Score Improvement",
    "specific": {
     "bardic_inspiration_die": 8,
     "song_of_rest_die": 6,
     "magical_secrets_max_5": 0,
     "magical_secrets_max_7": 0,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 4,
    "features": "Song of Rest (d8)",
    "specific": {
     "bardic_inspiration_die": 8,
     "song_of_rest_die": 8,
     "magical_secrets_max_5": 0,
     "magical_secrets_max_7": 0,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 4,
    "features": "Expertise, Bardic Inspiration (d10), Magical Secrets",
    "specific": {
     "bardic_inspiration_die": 10,
     "song_of_rest_die": 8,
     "magical_secrets_max_5": 2,
     "magical_secrets_max_7": 0,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 4,
    "features": "—",
    "specific": {
     "bardic_inspiration_die": 10,
     "song_of_rest_die": 8,
     "magical_secrets_max_5": 2,
     "magical_secrets_max_7": 0,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 4,
    "features": "Ability Score Improvement",
    "specific": {
     "bardic_inspiration_die": 10,
     "song_of_rest_die": 8,
     "magical_secrets_max_5": 2,
     "magical_secrets_max_7": 0,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 5,
    "features": "Song of Rest (d10)",
    "specific": {
     "bardic_inspiration_die": 10,
     "song_of_rest_die": 10,
     "magical_secrets_max_5": 2,
     "magical_secrets_max_7": 0,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 5,
    "features": "Magical Secrets, Bard College feature",
    "specific": {
     "bardic_inspiration_die": 10,
     "song_of_rest_die": 10,
     "magical_secrets_max_5": 2,
     "magical_secrets_max_7": 2,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 5,
    "features": "Bardic Inspiration (d12)",
    "specific": {
     "bardic_inspiration_die": 12,
     "song_of_rest_die": 10,
     "magical_secrets_max_5": 2,
     "magical_secrets_max_7": 2,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 5,
    "features": "Ability Score Improvement",
    "specific": {
     "bardic_inspiration_die": 12,
     "song_of_rest_die": 10,
     "magical_secrets_max_5": 2,
     "magical_secrets_max_7": 2,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 6,
    "features": "Song of Rest (d12)",
    "specific": {
     "bardic_inspiration_die": 12,
     "song_of_rest_die": 12,
     "magical_secrets_max_5": 2,
     "magical_secrets_max_7": 2,
     "magical_secrets_max_9": 0
    }
   },
   {
    "pb": 6,
    "features": "Magical Secrets",
    "specific": {
     "bardic_inspiration_die": 12,
     "song_of_rest_die": 12,
     "magical_secrets_max_5": 2,
     "magical_secrets_max_7": 2,
     "magical_secrets_max_9": 2
    }
   },
   {
    "pb": 6,
    "features": "Ability Score Improvement",
    "specific": {
     "bardic_inspiration_die": 12,
     "song_of_rest_die": 12,
     "magical_secrets_max_5": 2,
     "magical_secrets_max_7": 2,
     "magical_secrets_max_9": 2
    }
   },
   {
    "pb": 6,
    "features": "Superior Inspiration",
    "specific": {
     "bardic_inspiration_die": 12,
     "song_of_rest_die": 12,
     "magical_secrets_max_5": 2,
     "magical_secrets_max_7": 2,
     "magical_secrets_max_9": 2
    }
   }
  ]
 },
 "cleric": {
  "fm": {
   "name": "Cleric",
   "description": "Cleric: d8 HD, saves WIS/CHA",
   "hit_die": 8,
   "saves": [
    "WIS",
    "CHA"
   ],
   "subclass": [
    "Life"
   ]
  },
  "prof_line": "Choose two from History, Insight, Medicine, Persuasion, and Religion",
  "rows": [
   {
    "pb": 2,
    "features": "Spellcasting: Cleric, Divine Domain, Domain Spells",
    "specific": {
     "channel_divinity_charges": 0,
     "destroy_undead_cr": 0
    }
   },
   {
    "pb": 2,
    "features": "Channel Divinity (1/rest), Channel Divinity: Turn Undead, Divine Domain feature",
    "specific": {
     "channel_divinity_charges": 1,
     "destroy_undead_cr": 0
    }
   },
   {
    "pb": 2,
    "features": "Domain Spells",
    "specific": {
     "channel_divinity_charges": 1,
     "destroy_undead_cr": 0
    }
   },
   {
    "pb": 2,
    "features": "Ability Score Improvement",
    "specific": {
     "channel_divinity_charges": 1,
     "destroy_undead_cr": 0
    }
   },
   {
    "pb": 3,
    "features": "Domain Spells, Destroy Undead (CR 1/2 or below)",
    "specific": {
     "channel_divinity_charges": 1,
     "destroy_undead_cr": 0.5
    }
   },
   {
    "pb": 3,
    "features": "Channel Divinity (2/rest), Divine Domain feature",
    "specific": {
     "channel_divinity_charges": 2,
     "destroy_undead_cr": 0.5
    }
   },
   {
    "pb": 3,
    "features": "Domain Spells",
    "specific": {
     "channel_divinity_charges": 2,
     "destroy_undead_cr": 0.5
    }
   },
   {
    "pb": 3,
    "features": "Ability Score Improvement, Destroy Undead (CR 1 or below), Divine Domain feature",
    "specific": {
     "channel_divinity_charges": 2,
     "destroy_undead_cr": 1
    }
   },
   {
    "pb": 4,
    "features": "Domain Spells",
    "specific": {
     "channel_divinity_charges": 2,
     "destroy_undead_cr": 1
    }
   },
   {
    "pb": 4,
    "features": "Divine Intervention",
    "specific": {
     "channel_divinity_charges": 2,
     "destroy_undead_cr": 1
    }
   },
   {
    "pb": 4,
    "features": "Destroy Undead (CR 2 or below)",
    "specific": {
     "channel_divinity_charges": 2,
     "destroy_undead_cr": 2
    }
   },
   {
    "pb": 4,
    "features": "Ability Score Improvement",
    "specific": {
     "channel_divinity_charges": 2,
     "destroy_undead_cr": 2
    }
   },
   {
    "pb": 5,
    "features": "—",
    "specific": {
     "channel_divinity_charges": 2,
     "destroy_undead_cr": 2
    }
   },
   {
    "pb": 5,
    "features": "Destroy Undead (CR 3 or below)",
    "specific": {
     "channel_divinity_charges": 2,
     "destroy_undead_cr": 3
    }
   },
   {
    "pb": 5,
    "features": "—",
    "specific": {
     "channel_divinity_charges": 2,
     "destroy_undead_cr": 3
    }
   },
   {
    "pb": 5,
    "features": "Ability Score Improvement",
    "specific": {
     "channel_divinity_charges": 2,
     "destroy_undead_cr": 3
    }
   },
   {
    "pb": 6,
    "features": "Destroy Undead (CR 4 or below), Divine Domain feature",
    "specific": {
     "channel_divinity_charges": 2,
     "destroy_undead_cr": 4
    }
   },
   {
    "pb": 6,
    "features": "Channel Divinity (3/rest)",
    "specific": {
     "channel_divinity_charges": 3,
     "destroy_undead_cr": 4
    }
   },
   {
    "pb": 6,
    "features": "Ability Score Improvement",
    "specific": {
     "channel_divinity_charges": 3,
     "destroy_undead_cr": 4
    }
   },
   {
    "pb": 6,
    "features": "Divine Intervention Improvement",
    "specific": {
     "channel_divinity_charges": 3,
     "destroy_undead_cr": 4
    }
   }
  ]
 },
 "druid": {
  "fm": {
   "name": "Druid",
   "description": "Druid: d8 HD, saves INT/WIS",
   "hit_die": 8,
   "saves": [
    "INT",
    "WIS"
   ],
   "subclass": [
    "Land"
   ]
  },
  "prof_line": "Choose two from Arcana, Animal Handling, Insight, Medicine, Nature, Perception, Religion, and Survival",
  "rows": [
   {
    "pb": 2,
    "features": "Spellcasting: Druid, Druidic",
    "specific": {
     "wild_shape_max_cr": 0,
     "wild_shape_swim": false,
     "wild_shape_fly": false
    }
   },
   {
    "pb": 2,
    "features": "Wild Shape (CR 1/4 or below, no flying or swim speed), Druid Circle",
    "specific": {
     "wild_shape_max_cr": 0.25,
     "wild_shape_swim": false,
     "wild_shape_fly": false
    }
   },
   {
    "pb": 2,
    "features": "—",
    "specific": {
     "wild_shape_max_cr": 0.25,
     "wild_shape_swim": false,
     "wild_shape_fly": false
    }
   },
   {
    "pb": 2,
    "features": "Wild Shape (CR 1/2 or below, no flying speed), Ability Score Improvement",
    "specific": {
     "wild_shape_max_cr": 0.5,
     "wild_shape_swim": true,
     "wild_shape_fly": false
    }
   },
   {
    "pb": 3,
    "features": "—",
    "specific": {
     "wild_shape_max_cr": 0.5,
     "wild_shape_swim": true,
     "wild_shape_fly": false
    }
   },
   {
    "pb": 3,
    "features": "Druid Circle feature",
    "specific": {
     "wild_shape_max_cr": 0.5,
     "wild_shape_swim": true,
     "wild_shape_fly": false
    }
   },
   {
    "pb": 3,
    "features": "—",
    "specific": {
     "wild_shape_max_cr": 1,
     "wild_shape_swim": true,
     "wild_shape_fly": false
    }
   },
   {
    "pb": 3,
    "features": "Wild Shape (CR 1 or below), Ability Score Improvement",
    "specific": {
     "wild_shape_max_cr": 1,
     "wild_shape_swim": true,
     "wild_shape_fly": true
    }
   },
   {
    "pb": 4,
    "features": "—",
    "specific": {
     "wild_shape_max_cr": 1,
     "wild_shape_swim": true,
     "wild_shape_fly": true
    }
   },
   {
    "pb": 4,
    "features": "Druid Circle feature",
    "specific": {
     "wild_shape_max_cr": 1,
     "wild_shape_swim": true,
     "wild_shape_fly": true
    }
   },
   {
    "pb": 4,
    "features": "—",
    "specific": {
     "wild_shape_max_cr": 1,
     "wild_shape_swim": true,
     "wild_shape_fly": true
    }
   },
   {
    "pb": 4,
    "features": "Ability Score Improvement",
    "specific": {
     "wild_shape_max_cr": 1,
     "wild_shape_swim": true,
     "wild_shape_fly": true
    }
   },
   {
    "pb": 5,
    "features": "—",
    "specific": {
     "wild_shape_max_cr": 1,
     "wild_shape_swim": true,
     "wild_shape_fly": true
    }
   },
   {
    "pb": 5,
    "features": "Druid Circle feature",
    "specific": {
     "wild_shape_max_cr": 1,
     "wild_shape_swim": true,
     "wild_shape_fly": true
    }
   },
   {
    "pb": 5,
    "features": "—",
    "specific": {
     "wild_shape_max_cr": 1,
     "wild_shape_swim": true,
     "wild_shape_fly": true
    }
   },
   {
    "pb": 5,
    "features": "Ability Score Improvement",
    "specific": {
     "wild_shape_max_cr": 1,
     "wild_shape_swim": true,
     "wild_shape_fly": true
    }
   },
   {
    "pb": 6,
    "features": "—",
    "specific": {
     "wild_shape_max_cr": 1,
     "wild_shape_swim": true,
     "wild_shape_fly": true
    }
   },
   {
    "pb": 6,
    "features": "Timeless Body, Beast Spells",
    "specific": {
     "wild_shape_max_cr": 1,
     "wild_shape_swim": true,
     "wild_shape_fly": true
    }
   },
   {
    "pb": 6,
    "features": "Ability Score Improvement",
    "specific": {
     "wild_shape_max_cr": 1,
     "wild_shape_swim": true,
     "wild_shape_fly": true
    }
   },
   {
    "pb": 6,
    "features": "Archdruid",
    "specific": {
     "wild_shape_max_cr": 1,
     "wild_shape_swim": true,
     "wild_shape_fly": true
    }
   }
  ]
 },
 "fighter": {
  "fm": {
   "name": "Fighter",
   "description": "Fighter: d10 HD, saves STR/CON",
   "hit_die": 10,
   "saves": [
    "STR",
    "CON"
   ],
   "subclass": [
    "Champion"
   ]
  },
  "prof_line": "Choose two skills from Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, and Survival",
  "rows": [
   {
    "pb": 2,
    "features": "Fighting Style, Second Wind",
    "specific": {
     "action_surges": 0,
     "indomitable_uses": 0,
     "extra_attacks": 0
    }
   },
   {
    "pb": 2,
    "features": "Action Surge (1 use)",
    "specific": {
     "action_surges": 1,
     "indomitable_uses": 0,
     "extra_attacks": 0
    }
   },
   {
    "pb": 2,
    "features": "Martial Archetype",
    "specific": {
     "action_surges": 1,
     "indomitable_uses": 0,
     "extra_attacks": 0
    }
   },
   {
    "pb": 2,
    "features": "Ability Score Improvement",
    "specific": {
     "action_surges": 1,
     "indomitable_uses": 0,
     "extra_attacks": 0
    }
   },
   {
    "pb": 3,
    "features": "Extra Attack",
    "specific": {
     "action_surges": 1,
     "indomitable_uses": 0,
     "extra_attacks": 1
    }
   },
   {
    "pb": 3,
    "features": "Ability Score Improvement",
    "specific": {
     "action_surges": 1,
     "indomitable_uses": 0,
     "extra_attacks": 1
    }
   },
   {
    "pb": 3,
    "features": "Martial Archetype feature",
    "specific": {
     "action_surges": 1,
     "indomitable_uses": 0,
     "extra_attacks": 1
    }
   },
   {
    "pb": 3,
    "features": "Ability Score Improvement",
    "specific": {
     "action_surges": 1,
     "indomitable_uses": 0,
     "extra_attacks": 1
    }
   },
   {
    "pb": 4,
    "features": "Indomitable (1 use)",
    "specific": {
     "action_surges": 1,
     "indomitable_uses": 1,
     "extra_attacks": 1
    }
   },
   {
    "pb": 4,
    "features": "Martial Archetype feature",
    "specific": {
     "action_surges": 1,
     "indomitable_uses": 1,
     "extra_attacks": 1
    }
   },
   {
    "pb": 4,
    "features": "Extra Attack (2)",
    "specific": {
     "action_surges": 1,
     "indomitable_uses": 1,
     "extra_attacks": 2
    }
   },
   {
    "pb": 4,
    "features": "Ability Score Improvement",
    "specific": {
     "action_surges": 1,
     "indomitable_uses": 1,
     "extra_attacks": 2
    }
   },
   {
    "pb": 5,
    "features": "Indomitable (2 uses)",
    "specific": {
     "action_surges": 1,
     "indomitable_uses": 2,
     "extra_attacks": 2
    }
   },
   {
    "pb": 5,
    "features": "Ability Score Improvement",
    "specific": {
     "action_surges": 1,
     "indomitable_uses": 2,
     "extra_attacks": 2
    }
   },
   {
    "pb": 5,
    "features": "Martial Archetype feature",
    "specific": {
     "action_surges": 1,
     "indomitable_uses": 2,
     "extra_attacks": 2
    }
   },
   {
    "pb": 5,
    "features": "Ability Score Improvement",
    "specific": {
     "action_surges": 1,
     "indomitable_uses": 2,
     "extra_attacks": 2
    }
   },
   {
    "pb": 6,
    "features": "Action Surge (2 uses), Indomitable (3 uses)",
    "specific": {
     "action_surges": 2,
     "indomitable_uses": 3,
     "extra_attacks": 2
    }
   },
   {
    "pb": 6,
    "features": "Martial Archetype feature",
    "specific": {
     "action_surges": 2,
     "indomitable_uses": 3,
     "extra_attacks": 2
    }
   },
   {
    "pb": 6,
    "features": "Ability Score Improvement",
    "specific": {
     "action_surges": 2,
     "indomitable_uses": 3,
     "extra_attacks": 2
    }
   },
   {
    "pb": 6,
    "features": "Extra Attack (3)",
    "specific": {
     "action_surges": 2,
     "indomitable_uses": 3,
     "extra_attacks": 3
    }
   }
  ]
 },
 "monk": {
  "fm": {
   "name": "Monk",
   "description": "Monk: d8 HD, saves STR/DEX",
   "hit_die": 8,
   "saves": [
    "STR",
    "DEX"
   ],
   "subclass": [
    "Open Hand"
   ]
  },
  "prof_line": "Choose two from Acrobatics, Athletics, History, Insight, Religion, and Stealth",
  "rows": [
   {
    "pb": 2,
    "features": "Unarmored Defense, Martial Arts",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 4
     },
     "ki_points": 0,
     "unarmored_movement": 0
    }
   },
   {
    "pb": 2,
    "features": "Ki, Flurry of Blows, Patient Defense, Step of the Wind, Unarmored Movement",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 4
     },
     "ki_points": 2,
     "unarmored_movement": 10
    }
   },
   {
    "pb": 2,
    "features": "Monastic Tradition, Deflect Missiles",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 4
     },
     "ki_points": 3,
     "unarmored_movement": 10
    }
   },
   {
    "pb": 2,
    "features": "Ability Score Improvement, Slow Fall",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 4
     },
     "ki_points": 4,
     "unarmored_movement": 10
    }
   },
   {
    "pb": 3,
    "features": "Extra Attack, Stunning Strike",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 6
     },
     "ki_points": 5,
     "unarmored_movement": 10
    }
   },
   {
    "pb": 3,
    "features": "Ki Empowered Strikes, Monastic Tradition feature",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 6
     },
     "ki_points": 6,
     "unarmored_movement": 15
    }
   },
   {
    "pb": 3,
    "features": "Evasion, Stillness of Mind",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 6
     },
     "ki_points": 7,
     "unarmored_movement": 15
    }
   },
   {
    "pb": 3,
    "features": "Ability Score Improvement",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 6
     },
     "ki_points": 8,
     "unarmored_movement": 15
    }
   },
   {
    "pb": 4,
    "features": "Unarmored Movement",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 6
     },
     "ki_points": 9,
     "unarmored_movement": 15
    }
   },
   {
    "pb": 4,
    "features": "Purity of Body",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 6
     },
     "ki_points": 10,
     "unarmored_movement": 20
    }
   },
   {
    "pb": 4,
    "features": "Monastic Tradition feature",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 8
     },
     "ki_points": 11,
     "unarmored_movement": 20
    }
   },
   {
    "pb": 4,
    "features": "Ability Score Improvement",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 8
     },
     "ki_points": 12,
     "unarmored_movement": 20
    }
   },
   {
    "pb": 5,
    "features": "Tongue of the Sun and Moon",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 8
     },
     "ki_points": 13,
     "unarmored_movement": 20
    }
   },
   {
    "pb": 5,
    "features": "Diamond Soul",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 8
     },
     "ki_points": 14,
     "unarmored_movement": 25
    }
   },
   {
    "pb": 5,
    "features": "Timeless Body",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 8
     },
     "ki_points": 15,
     "unarmored_movement": 25
    }
   },
   {
    "pb": 5,
    "features": "Ability Score Improvement",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 8
     },
     "ki_points": 16,
     "unarmored_movement": 25
    }
   },
   {
    "pb": 6,
    "features": "Monastic Tradition feature",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 10
     },
     "ki_points": 17,
     "unarmored_movement": 25
    }
   },
   {
    "pb": 6,
    "features": "Empty Body",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 10
     },
     "ki_points": 18,
     "unarmored_movement": 30
    }
   },
   {
    "pb": 6,
    "features": "Ability Score Improvement",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 10
     },
     "ki_points": 19,
     "unarmored_movement": 30
    }
   },
   {
    "pb": 6,
    "features": "Perfect Self",
    "specific": {
     "martial_arts": {
      "dice_count": 1,
      "dice_value": 10
     },
     "ki_points": 20,
     "unarmored_movement": 30
    }
   }
  ]
 },
 "paladin": {
  "fm": {
   "name": "Paladin",
   "description": "Paladin: d10 HD, saves WIS/CHA",
   "hit_die": 10,
   "saves": [
    "WIS",
    "CHA"
   ],
   "subclass": [
    "Devotion"
   ]
  },
  "prof_line": "Choose two from Athletics, Insight, Intimidation, Medicine, Persuasion, and Religion",
  "rows": [
   {
    "pb": 2,
    "features": "Divine Sense, Lay on Hands",
    "specific": {
     "aura_range": 0
    }
   },
   {
    "pb": 2,
    "features": "Fighting Style, Spellcasting: Paladin, Divine Smite",
    "specific": {
     "aura_range": 0
    }
   },
   {
    "pb": 2,
    "features": "Divine Health, Sacred Oath, Oath Spells, Channel Divinity",
    "specific": {
     "aura_range": 0
    }
   },
   {
    "pb": 2,
    "features": "Ability Score Improvement",
    "specific": {
     "aura_range": 0
    }
   },
   {
    "pb": 3,
    "features": "Extra Attack",
    "specific": {
     "aura_range": 0
    }
   },
   {
    "pb": 3,
    "features": "Aura of Protection",
    "specific": {
     "aura_range": 10
    }
   },
   {
    "pb": 3,
    "features": "Sacred Oath feature",
    "specific": {
     "aura_range": 10
    }
   },
   {
    "pb": 3,
    "features": "Ability Score Improvement",
    "specific": {
     "aura_range": 10
    }
   },
   {
    "pb": 4,
    "features": "—",
    "specific": {
     "aura_range": 10
    }
   },
   {
    "pb": 4,
    "features": "Aura of Courage",
    "specific": {
     "aura_range": 10
    }
   },
   {
    "pb": 4,
    "features": "Improved Divine Smite",
    "specific": {
     "aura_range": 10
    }
   },
   {
    "pb": 4,
    "features": "Ability Score Improvement",
    "specific": {
     "aura_range": 10
    }
   },
   {
    "pb": 5,
    "features": "—",
    "specific": {
     "aura_range": 10
    }
   },
   {
    "pb": 5,
    "features": "Cleansing Touch",
    "specific": {
     "aura_range": 10
    }
   },
   {
    "pb": 5,
    "features": "Sacred Oath feature",
    "specific": {
     "aura_range": 10
    }
   },
   {
    "pb": 5,
    "features": "Ability Score Improvement",
    "specific": {
     "aura_range": 10
    }
   },
   {
    "pb": 6,
    "features": "—",
    "specific": {
     "aura_range": 10
    }
   },
   {
    "pb": 6,
    "features": "Aura improvements",
    "specific": {
     "aura_range": 30
    }
   },
   {
    "pb": 6,
    "features": "Ability Score Improvement",
    "specific": {
     "aura_range": 30
    }
   },
   {
    "pb": 6,
    "features": "Sacred Oath feature",
    "specific": {
     "aura_range": 30
    }
   }
  ]
 },
 "ranger": {
  "fm": {
   "name": "Ranger",
   "description": "Ranger: d10 HD, saves STR/DEX",
   "hit_die": 10,
   "saves": [
    "STR",
    "DEX"
   ],
   "subclass": [
    "Hunter"
   ]
  },
  "prof_line": "Choose three from Animal Handling, Athletics, Insight, Investigation, Nature, Perception, Stealth, and Survival",
  "rows": [
   {
    "pb": 2,
    "features": "Favored Enemy (1 type), Natural Explorer (1 terrain type)",
    "specific": {
     "favored_enemies": 1,
     "favored_terrain": 1
    }
   },
   {
    "pb": 2,
    "features": "Fighting Style, Spellcasting: Ranger",
    "specific": {
     "favored_enemies": 1,
     "favored_terrain": 1
    }
   },
   {
    "pb": 2,
    "features": "Ranger Archetype, Primeval Awareness",
    "specific": {
     "favored_enemies": 1,
     "favored_terrain": 1
    }
   },
   {
    "pb": 2,
    "features": "Ability Score Improvement",
    "specific": {
     "favored_enemies": 1,
     "favored_terrain": 1
    }
   },
   {
    "pb": 3,
    "features": "Extra Attack",
    "specific": {
     "favored_enemies": 1,
     "favored_terrain": 1
    }
   },
   {
    "pb": 3,
    "features": "Favored Enemy (2 types), Natural Explorer (2 terrain types)",
    "specific": {
     "favored_enemies": 2,
     "favored_terrain": 2
    }
   },
   {
    "pb": 3,
    "features": "Ranger Archetype feature",
    "specific": {
     "favored_enemies": 2,
     "favored_terrain": 2
    }
   },
   {
    "pb": 3,
    "features": "Ability Score Improvement, Land's Stride",
    "specific": {
     "favored_enemies": 2,
     "favored_terrain": 2
    }
   },
   {
    "pb": 4,
    "features": "—",
    "specific": {
     "favored_enemies": 2,
     "favored_terrain": 2
    }
   },
   {
    "pb": 4,
    "features": "Natural Explorer (3 terrain types), Hide in Plain Sight",
    "specific": {
     "favored_enemies": 2,
     "favored_terrain": 3
    }
   },
   {
    "pb": 4,
    "features": "Ranger Archetype feature",
    "specific": {
     "favored_enemies": 2,
     "favored_terrain": 3
    }
   },
   {
    "pb": 4,
    "features": "Ability Score Improvement",
    "specific": {
     "favored_enemies": 2,
     "favored_terrain": 3
    }
   },
   {
    "pb": 5,
    "features": "—",
    "specific": {
     "favored_enemies": 2,
     "favored_terrain": 3
    }
   },
   {
    "pb": 5,
    "features": "Favored Enemy (3 enemies), Vanish",
    "specific": {
     "favored_enemies": 3,
     "favored_terrain": 3
    }
   },
   {
    "pb": 5,
    "features": "Ranger Archetype feature",
    "specific": {
     "favored_enemies": 3,
     "favored_terrain": 3
    }
   },
   {
    "pb": 5,
    "features": "Ability Score Improvement",
    "specific": {
     "favored_enemies": 3,
     "favored_terrain": 3
    }
   },
   {
    "pb": 6,
    "features": "—",
    "specific": {
     "favored_enemies": 3,
     "favored_terrain": 3
    }
   },
   {
    "pb": 6,
    "features": "Feral Senses",
    "specific": {
     "favored_enemies": 3,
     "favored_terrain": 3
    }
   },
   {
    "pb": 6,
    "features": "Ability Score Improvement",
    "specific": {
     "favored_enemies": 3,
     "favored_terrain": 3
    }
   },
   {
    "pb": 6,
    "features": "Foe Slayer",
    "specific": {
     "favored_enemies": 3,
     "favored_terrain": 3
    }
   }
  ]
 },
 "rogue": {
  "fm": {
   "name": "Rogue",
   "description": "Rogue: d8 HD, saves DEX/INT",
   "hit_die": 8,
   "saves": [
    "DEX",
    "INT"
   ],
   "subclass": [
    "Thief"
   ]
  },
  "prof_line": "Choose four from Acrobatics, Athletics, Deception, Insight, Intimidation, Investigation, Perception, Performance, Persuasion, Sleight of Hand, and Stealth",
  "rows": [
   {
    "pb": 2,
    "features": "Expertise, Sneak Attack, Thieves' Cant",
    "specific": {
     "sneak_attack": {
      "dice_count": 1,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 2,
    "features": "Cunning Action",
    "specific": {
     "sneak_attack": {
      "dice_count": 1,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 2,
    "features": "Roguish Archetype",
    "specific": {
     "sneak_attack": {
      "dice_count": 2,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 2,
    "features": "Ability Score Improvement",
    "specific": {
     "sneak_attack": {
      "dice_count": 2,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 3,
    "features": "Uncanny Dodge",
    "specific": {
     "sneak_attack": {
      "dice_count": 3,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 3,
    "features": "Expertise",
    "specific": {
     "sneak_attack": {
      "dice_count": 3,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 3,
    "features": "Evasion",
    "specific": {
     "sneak_attack": {
      "dice_count": 4,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 3,
    "features": "Ability Score Improvement",
    "specific": {
     "sneak_attack": {
      "dice_count": 4,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 4,
    "features": "Roguish Archetype feature",
    "specific": {
     "sneak_attack": {
      "dice_count": 5,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 4,
    "features": "Ability Score Improvement",
    "specific": {
     "sneak_attack": {
      "dice_count": 5,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 4,
    "features": "Reliable Talent",
    "specific": {
     "sneak_attack": {
      "dice_count": 6,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 4,
    "features": "Ability Score Improvement",
    "specific": {
     "sneak_attack": {
      "dice_count": 6,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 5,
    "features": "Roguish Archetype feature",
    "specific": {
     "sneak_attack": {
      "dice_count": 7,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 5,
    "features": "Blindsense",
    "specific": {
     "sneak_attack": {
      "dice_count": 7,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 5,
    "features": "Slippery Mind",
    "specific": {
     "sneak_attack": {
      "dice_count": 8,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 5,
    "features": "Ability Score Improvement",
    "specific": {
     "sneak_attack": {
      "dice_count": 8,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 6,
    "features": "Roguish Archetype feature",
    "specific": {
     "sneak_attack": {
      "dice_count": 9,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 6,
    "features": "Elusive",
    "specific": {
     "sneak_attack": {
      "dice_count": 9,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 6,
    "features": "Ability Score Improvement",
    "specific": {
     "sneak_attack": {
      "dice_count": 10,
      "dice_value": 6
     }
    }
   },
   {
    "pb": 6,
    "features": "Stroke of Luck",
    "specific": {
     "sneak_attack": {
      "dice_count": 10,
      "dice_value": 6
     }
    }
   }
  ]
 },
 "sorcerer": {
  "fm": {
   "name": "Sorcerer",
   "description": "Sorcerer: d6 HD, saves CON/CHA",
   "hit_die": 6,
   "saves": [
    "CON",
    "CHA"
   ],
   "subclass": [
    "Draconic"
   ]
  },
  "prof_line": "Choose two from Arcana, Deception, Insight, Intimidation, Persuasion, and Religion",
  "rows": [
   {
    "pb": 2,
    "features": "Spellcasting: Sorcerer, Sorcerous Origin",
    "specific": {
     "sorcery_points": 0,
     "metamagic_known": 0,
     "creating_spell_slots": []
    }
   },
   {
    "pb": 2,
    "features": "Font of Magic, Flexible Casting: Creating Spell Slots, Flexible Casting: Converting Spell Slot",
    "specific": {
     "sorcery_points": 2,
     "metamagic_known": 0,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 2,
    "features": "Metamagic",
    "specific": {
     "sorcery_points": 3,
     "metamagic_known": 2,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 2,
    "features": "Ability Score Improvement",
    "specific": {
     "sorcery_points": 4,
     "metamagic_known": 2,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 3,
    "features": "—",
    "specific": {
     "sorcery_points": 5,
     "metamagic_known": 2,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 3,
    "features": "Sorcerous Origin feature",
    "specific": {
     "sorcery_points": 6,
     "metamagic_known": 2,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 3,
    "features": "—",
    "specific": {
     "sorcery_points": 7,
     "metamagic_known": 2,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 3,
    "features": "Ability Score Improvement",
    "specific": {
     "sorcery_points": 8,
     "metamagic_known": 2,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 4,
    "features": "—",
    "specific": {
     "sorcery_points": 9,
     "metamagic_known": 2,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 4,
    "features": "Metamagic",
    "specific": {
     "sorcery_points": 10,
     "metamagic_known": 3,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 4,
    "features": "—",
    "specific": {
     "sorcery_points": 11,
     "metamagic_known": 3,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 4,
    "features": "Ability Score Improvement",
    "specific": {
     "sorcery_points": 12,
     "metamagic_known": 3,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 5,
    "features": "—",
    "specific": {
     "sorcery_points": 13,
     "metamagic_known": 3,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 5,
    "features": "Sorcerous Origin feature",
    "specific": {
     "sorcery_points": 14,
     "metamagic_known": 3,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 5,
    "features": "—",
    "specific": {
     "sorcery_points": 15,
     "metamagic_known": 3,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 5,
    "features": "Ability Score Improvement",
    "specific": {
     "sorcery_points": 16,
     "metamagic_known": 4,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 6,
    "features": "Metamagic",
    "specific": {
     "sorcery_points": 17,
     "metamagic_known": 4,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 6,
    "features": "Sorcerous Origin feature",
    "specific": {
     "sorcery_points": 18,
     "metamagic_known": 4,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 6,
    "features": "Ability Score Improvement",
    "specific": {
     "sorcery_points": 19,
     "metamagic_known": 4,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   },
   {
    "pb": 6,
    "features": "Sorcerous Restoration",
    "specific": {
     "sorcery_points": 20,
     "metamagic_known": 4,
     "creating_spell_slots": [
      {
       "spell_slot_level": 1,
       "sorcery_point_cost": 2
      },
      {
       "spell_slot_level": 2,
       "sorcery_point_cost": 3
      },
      {
       "spell_slot_level": 3,
       "sorcery_point_cost": 5
      },
      {
       "spell_slot_level": 4,
       "sorcery_point_cost": 6
      },
      {
       "spell_slot_level": 5,
       "sorcery_point_cost": 7
      }
     ]
    }
   }
  ]
 },
 "warlock": {
  "fm": {
   "name": "Warlock",
   "description": "Warlock: d8 HD, saves WIS/CHA",
   "hit_die": 8,
   "saves": [
    "WIS",
    "CHA"
   ],
   "subclass": [
    "Fiend"
   ]
  },
  "prof_line": "Choose two skills from Arcana, Deception, History, Intimidation, Investigation, Nature, and Religion",
  "rows": [
   {
    "pb": 2,
    "features": "Otherworldly Patron, Pact Magic",
    "specific": {
     "invocations_known": 0,
     "mystic_arcanum_level_6": 0,
     "mystic_arcanum_level_7": 0,
     "mystic_arcanum_level_8": 0,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 2,
    "features": "Eldritch Invocations",
    "specific": {
     "invocations_known": 2,
     "mystic_arcanum_level_6": 0,
     "mystic_arcanum_level_7": 0,
     "mystic_arcanum_level_8": 0,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 2,
    "features": "Pact Boon",
    "specific": {
     "invocations_known": 2,
     "mystic_arcanum_level_6": 0,
     "mystic_arcanum_level_7": 0,
     "mystic_arcanum_level_8": 0,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 2,
    "features": "Ability Score Improvement",
    "specific": {
     "invocations_known": 3,
     "mystic_arcanum_level_6": 0,
     "mystic_arcanum_level_7": 0,
     "mystic_arcanum_level_8": 0,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 3,
    "features": "—",
    "specific": {
     "invocations_known": 3,
     "mystic_arcanum_level_6": 0,
     "mystic_arcanum_level_7": 0,
     "mystic_arcanum_level_8": 0,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 3,
    "features": "Otherworldly Patron feature",
    "specific": {
     "invocations_known": 4,
     "mystic_arcanum_level_6": 0,
     "mystic_arcanum_level_7": 0,
     "mystic_arcanum_level_8": 0,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 3,
    "features": "—",
    "specific": {
     "invocations_known": 4,
     "mystic_arcanum_level_6": 0,
     "mystic_arcanum_level_7": 0,
     "mystic_arcanum_level_8": 0,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 3,
    "features": "Ability Score Improvement",
    "specific": {
     "invocations_known": 4,
     "mystic_arcanum_level_6": 0,
     "mystic_arcanum_level_7": 0,
     "mystic_arcanum_level_8": 0,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 4,
    "features": "—",
    "specific": {
     "invocations_known": 5,
     "mystic_arcanum_level_6": 0,
     "mystic_arcanum_level_7": 0,
     "mystic_arcanum_level_8": 0,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 4,
    "features": "Otherworldly Patron feature",
    "specific": {
     "invocations_known": 5,
     "mystic_arcanum_level_6": 0,
     "mystic_arcanum_level_7": 0,
     "mystic_arcanum_level_8": 0,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 4,
    "features": "Mystic Arcanum (6th level)",
    "specific": {
     "invocations_known": 5,
     "mystic_arcanum_level_6": 1,
     "mystic_arcanum_level_7": 0,
     "mystic_arcanum_level_8": 0,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 4,
    "features": "Ability Score Improvement",
    "specific": {
     "invocations_known": 6,
     "mystic_arcanum_level_6": 1,
     "mystic_arcanum_level_7": 0,
     "mystic_arcanum_level_8": 0,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 5,
    "features": "Mystic Arcanum (7th level)",
    "specific": {
     "invocations_known": 6,
     "mystic_arcanum_level_6": 1,
     "mystic_arcanum_level_7": 1,
     "mystic_arcanum_level_8": 0,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 5,
    "features": "Otherworldly Patron feature",
    "specific": {
     "invocations_known": 6,
     "mystic_arcanum_level_6": 1,
     "mystic_arcanum_level_7": 1,
     "mystic_arcanum_level_8": 0,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 5,
    "features": "Mystic Arcanum (8th level)",
    "specific": {
     "invocations_known": 7,
     "mystic_arcanum_level_6": 1,
     "mystic_arcanum_level_7": 1,
     "mystic_arcanum_level_8": 1,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 5,
    "features": "Ability Score Improvement",
    "specific": {
     "invocations_known": 7,
     "mystic_arcanum_level_6": 1,
     "mystic_arcanum_level_7": 1,
     "mystic_arcanum_level_8": 1,
     "mystic_arcanum_level_9": 0
    }
   },
   {
    "pb": 6,
    "features": "Mystic Arcanum (9th level)",
    "specific": {
     "invocations_known": 7,
     "mystic_arcanum_level_6": 1,
     "mystic_arcanum_level_7": 1,
     "mystic_arcanum_level_8": 1,
     "mystic_arcanum_level_9": 1
    }
   },
   {
    "pb": 6,
    "features": "—",
    "specific": {
     "invocations_known": 8,
     "mystic_arcanum_level_6": 1,
     "mystic_arcanum_level_7": 1,
     "mystic_arcanum_level_8": 1,
     "mystic_arcanum_level_9": 1
    }
   },
   {
    "pb": 6,
    "features": "Ability Score Improvement",
    "specific": {
     "invocations_known": 8,
     "mystic_arcanum_level_6": 1,
     "mystic_arcanum_level_7": 1,
     "mystic_arcanum_level_8": 1,
     "mystic_arcanum_level_9": 1
    }
   },
   {
    "pb": 6,
    "features": "Eldritch Master",
    "specific": {
     "invocations_known": 8,
     "mystic_arcanum_level_6": 1,
     "mystic_arcanum_level_7": 1,
     "mystic_arcanum_level_8": 1,
     "mystic_arcanum_level_9": 1
    }
   }
  ]
 },
 "wizard": {
  "fm": {
   "name": "Wizard",
   "description": "Wizard: d6 HD, saves INT/WIS",
   "hit_die": 6,
   "saves": [
    "INT",
    "WIS"
   ],
   "subclass": [
    "Evocation"
   ]
  },
  "prof_line": "Choose two from Arcana, History, Insight, Investigation, Medicine, and Religion",
  "rows": [
   {
    "pb": 2,
    "features": "Spellcasting: Wizard, Arcane Recovery",
    "specific": {
     "arcane_recovery_levels": 1
    }
   },
   {
    "pb": 2,
    "features": "Arcane Tradition",
    "specific": {
     "arcane_recovery_levels": 1
    }
   },
   {
    "pb": 2,
    "features": "—",
    "specific": {
     "arcane_recovery_levels": 2
    }
   },
   {
    "pb": 2,
    "features": "Ability Score Improvement",
    "specific": {
     "arcane_recovery_levels": 2
    }
   },
   {
    "pb": 3,
    "features": "—",
    "specific": {
     "arcane_recovery_levels": 3
    }
   },
   {
    "pb": 3,
    "features": "Arcane Tradition feature",
    "specific": {
     "arcane_recovery_levels": 3
    }
   },
   {
    "pb": 3,
    "features": "—",
    "specific": {
     "arcane_recovery_levels": 4
    }
   },
   {
    "pb": 3,
    "features": "Ability Score Improvement",
    "specific": {
     "arcane_recovery_levels": 4
    }
   },
   {
    "pb": 4,
    "features": "—",
    "specific": {
     "arcane_recovery_levels": 5
    }
   },
   {
    "pb": 4,
    "features": "Arcane Tradition feature",
    "specific": {
     "arcane_recovery_levels": 5
    }
   },
   {
    "pb": 4,
    "features": "—",
    "specific": {
     "arcane_recovery_levels": 6
    }
   },
   {
    "pb": 4,
    "features": "Ability Score Improvement",
    "specific": {
     "arcane_recovery_levels": 6
    }
   },
   {
    "pb": 5,
    "features": "—",
    "specific": {
     "arcane_recovery_levels": 7
    }
   },
   {
    "pb": 5,
    "features": "Arcane Tradition feature",
    "specific": {
     "arcane_recovery_levels": 7
    }
   },
   {
    "pb": 5,
    "features": "—",
    "specific": {
     "arcane_recovery_levels": 8
    }
   },
   {
    "pb": 5,
    "features": "Ability Score Improvement",
    "specific": {
     "arcane_recovery_levels": 8
    }
   },
   {
    "pb": 6,
    "features": "—",
    "specific": {
     "arcane_recovery_levels": 9
    }
   },
   {
    "pb": 6,
    "features": "Spell Mastery",
    "specific": {
     "arcane_recovery_levels": 9
    }
   },
   {
    "pb": 6,
    "features": "Ability Score Improvement",
    "specific": {
     "arcane_recovery_levels": 10
    }
   },
   {
    "pb": 6,
    "features": "Signature Spell",
    "specific": {
     "arcane_recovery_levels": 10
    }
   }
  ]
 }
}
