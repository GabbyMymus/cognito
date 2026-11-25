/* Stimuli for the Interference Match task.
 * - WORDS: concrete nouns used as memory items (no overlap with the rhyme words).
 * - RHYME_FAMILIES: words for the verbal (rhyme-judgement) distractor.
 * - Shapes: random asymmetric polygons, generated from a numeric seed so every
 *   shape in the data file can be redrawn later (shape id = "S" + seed).
 */
(function () {
  'use strict';

  const RHYME_FAMILIES = [
    ['cat', 'hat', 'bat', 'mat'], ['cake', 'lake', 'rake', 'snake'],
    ['light', 'kite', 'night', 'bite'], ['boat', 'coat', 'goat', 'note'],
    ['ring', 'king', 'sing', 'wing'], ['bell', 'shell', 'well', 'tell'],
    ['rain', 'train', 'chain', 'brain'], ['bear', 'chair', 'hair', 'pear'],
    ['moon', 'spoon', 'tune', 'dune'], ['fish', 'dish', 'wish', 'swish'],
    ['rock', 'sock', 'clock', 'lock'], ['tree', 'bee', 'key', 'sea'],
    ['bone', 'phone', 'stone', 'cone'], ['bug', 'rug', 'mug', 'jug'],
    ['ten', 'pen', 'hen', 'men'], ['frog', 'log', 'dog', 'fog'],
    ['sand', 'hand', 'band', 'land'], ['bed', 'red', 'bread', 'head'],
    ['star', 'car', 'jar', 'bar'], ['nose', 'rose', 'hose', 'toes']
  ];

  const RAW_WORDS = `apple anchor arrow badge banana basket beetle belt bench blanket bottle bowl
  branch bridge broom bucket button cabin camel candle cannon carpet carrot castle cherry circus
  cliff cloud coin collar comb copper cotton crown cushion daisy desert diamond dolphin donkey
  dragon drum eagle engine feather fence finger flag flute forest fork fountain garden garlic
  ghost giant glove guitar hammer harbor helmet honey horse island jacket jelly jungle kettle
  kitten ladder lemon lion lizard magnet mango maple marble mask meadow melon mirror monkey
  needle nest ocean olive onion orange oven owl paddle palace panda parrot peach pencil pepper
  piano pillow pirate planet pocket potato puppet pumpkin rabbit radio ribbon river robot rocket
  saddle salad salmon scarf school shadow sheep shovel silver sofa spider stamp statue sugar
  sweater sword table tiger tomato tower tractor trumpet tunnel turtle umbrella valley violin
  wagon walnut wallet whale window wizard wolf zebra acorn barrel beard blossom bubble cactus
  camera canyon captain chimney coconut compass cookie crayon crystal curtain doctor elbow
  elephant falcon farmer ferry folder gravel hamster harp iceberg igloo insect jewel kayak
  kiwi ladle lantern laptop leopard lobster locket lumber medal mitten muffin napkin noodle
  oyster padlock parcel peanut pebble pelican penguin pickle pigeon plum poodle puzzle quilt
  raccoon raisin saucer shark sled slipper squirrel teapot temple thimble ticket toaster
  tulip turkey vase vest volcano waffle walrus wheel whistle yogurt zipper badger bagel
  balloon beaver biscuit blender boulder bracelet butter cabbage canoe cobweb cricket dagger
  envelope eraser faucet garage goblin grape hammock hedge jaguar kennel koala lettuce llama
  mushroom mustard ostrich pajamas pantry parsley peacock pillar pizza pony pretzel prism
  rooster sandal sausage scooter seaweed sponge stapler stove suitcase tadpole tent trophy
  tuba vulture wardrobe weasel wrench yacht`;

  const rhymeSet = new Set(RHYME_FAMILIES.flat());
  const WORDS = Array.from(new Set(RAW_WORDS.split(/\s+/).filter(Boolean)))
    .filter(w => !rhymeSet.has(w));

  // Small seeded RNG (mulberry32) so shapes are reproducible from their seed.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Random polygon with 6-9 points at uneven radii => irregular, asymmetric shape.
  function shapePath(seed) {
    const r = rng(seed);
    const n = 5 + Math.floor(r() * 5);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + (r() - 0.5) * (Math.PI / n);
      const rad = 0.2 + r() * 0.8;
      pts.push([Math.cos(ang) * rad, Math.sin(ang) * rad]);
    }
    return 'M' + pts.map(p => p[0].toFixed(3) + ' ' + p[1].toFixed(3)).join(' L') + ' Z';
  }

  function shapeSVG(seed, rotateDeg, mirror) {
    const t = `rotate(${rotateDeg || 0}) scale(${mirror ? -1 : 1},1)`;
    return `<svg viewBox="-1 -1 2 2" aria-hidden="true"><path d="${shapePath(seed)}" transform="${t}"/></svg>`;
  }

  function newShapeSeed() { return 1 + Math.floor(Math.random() * 2147483646); }

  window.STIM = { WORDS, RHYME_FAMILIES, shapeSVG, newShapeSeed };
})();
