const alienSymbols = ['⏃','⏚','☊','⎅','⟒','⎎','☌','⊑','⟟','⟊','☍','⌰','⋔','⋏','⍜','⌿','⍾','⍀','⌇','⏁','⎍','⎐','⍙','⌖','⊬','⋉']
let alienDict = {}
let reverseDict = {}

function stableHash(word) {
  const encoder = new TextEncoder()
  const data = encoder.encode(word)
  return crypto.subtle.digest("SHA-256", data).then(buf => {
    const hashArray = Array.from(new Uint8Array(buf))
    const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return parseInt(hex.slice(0, 8), 16)
  })
}

function generateAlienDict(seed) {
  alienDict = {}
  reverseDict = {}
  const rng = mulberry32(seed)
  const symbols = [...Array(8).fill(alienSymbols)].flat().sort(() => 0.5 - rng())
  for (let ch of getAllowedChars()) {
    const encoded = Array(3).fill(0).map(() => symbols[Math.floor(rng() * symbols.length)]).join('')
    alienDict[ch] = encoded
    reverseDict[encoded] = ch
  }
}

function alienEncode(text) {
  return text.split('').map(ch => alienDict[ch] || ch).join(' ')
}

function alienDecode(code) {
  return code.trim().split(/\s+/).map(part => reverseDict[part] || '?').join('')
}

// dumb seedable RNG
function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function getAllowedChars() {
  return 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~ '
}
