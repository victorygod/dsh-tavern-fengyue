// DND 5e Dice Roller — usage: roll.mjs [n]d[sides] [modifier]
// Example: roll 2d6+3
const m = /^(\d*)d(\d+)([+-]\d+)?$/.exec(String(argv[0] ?? '1d20').trim()) ?? []
const count = Math.max(1, Number(m[1] ?? '1') || 1)
const sides = Math.max(2, Number(m[2] ?? '20'))
const modifier = Number(m[3] ?? '0') || 0
const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
const sum = rolls.reduce((a, b) => a + b, 0) + modifier
console.log(`Rolled ${argv[0] ?? ''} → ${sum} (each die: ${rolls.join('+')})${modifier >= 0 ? `+${modifier}` : modifier}`)
