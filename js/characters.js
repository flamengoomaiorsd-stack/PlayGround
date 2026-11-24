/* Dragon Ball Z inspired playable characters.
   These are fan-made pixel interpretations used to tint the first-person
   arm. They are not official assets and this project is not affiliated
   with the rights holders. */

export const CHARACTERS = {
  char_goku: {
    id: 'char_goku',
    skin: ['#e9b48c', '#e2a97f', '#f0bd96', '#dca074', '#f3c6a1'],
    sleeve: ['#e07a22', '#d96f1c', '#e8862e', '#c9631a'],
    accent: '#2f5d74',
    hair: '#171717',
    eye: '#20262e',
    label: 'Goku'
  },
  char_vegeta: {
    id: 'char_vegeta',
    skin: ['#e6b088', '#dfa57b', '#eeb891', '#d99b6f'],
    sleeve: ['#2f5d9e', '#2a5490', '#3768ad', '#24487d'],
    accent: '#e8e8e8',
    hair: '#141414',
    eye: '#20262e',
    label: 'Vegeta'
  },
  char_piccolo: {
    id: 'char_piccolo',
    skin: ['#7ba05a', '#6f9450', '#87ad65', '#63874a'],
    sleeve: ['#6a3fa0', '#5f3791', '#7749b0', '#552f82'],
    accent: '#e8e8e8',
    hair: '#2f5d3a',
    eye: '#20262e',
    label: 'Piccolo'
  },
  char_gohan: {
    id: 'char_gohan',
    skin: ['#e9b48c', '#e2a97f', '#f0bd96', '#dca074'],
    sleeve: ['#7a4fb0', '#6f47a2', '#8659bd', '#623d8f'],
    accent: '#e8c14a',
    hair: '#1a1a1a',
    eye: '#20262e',
    label: 'Gohan'
  },
  char_frieza: {
    id: 'char_frieza',
    skin: ['#e8e0ef', '#ddd3e8', '#f2ecf7', '#d0c4de'],
    sleeve: ['#6a3fa0', '#5f3791', '#7749b0', '#552f82'],
    accent: '#b06ad0',
    hair: '#8e5bb0',
    eye: '#b32020',
    label: 'Frieza'
  },
  char_trunks: {
    id: 'char_trunks',
    skin: ['#e9b48c', '#e2a97f', '#f0bd96', '#dca074'],
    sleeve: ['#3e6fa8', '#39679c', '#4579b3', '#335d8f'],
    accent: '#e8c14a',
    hair: '#b9a6e0',
    eye: '#20262e',
    label: 'Trunks'
  }
};

export function characterPalette(id) {
  return CHARACTERS[id] || null;
}
