// The player's movements as the game does them: the same swing of arms and
// legs (their size and their pace at walking and sprinting speed), the same
// slow sway of the arms that never stops, and the elytra opening a little
// while running.
import { FunctionAnimation } from 'skinview3d';

const TICKS = 20; // the game counts time in ticks, 20 a second

// the arms breathe: a little out and in, a little back and forth
function sway(skin, age) {
  const out = Math.cos(age * 0.09) * 0.05 + 0.05;
  const swing = Math.sin(age * 0.067) * 0.05;
  skin.rightArm.rotation.z = -out;
  skin.leftArm.rotation.z = out;
  skin.rightArm.rotation.x += swing;
  skin.leftArm.rotation.x -= swing;
}

// The elytra's wings as the game sets them: folded back (15°) and, while
// running, a little open (the angles the game gives them when the player
// crouches). Like the game, they move a tenth of the way there each tick.
const WINGS_FOLDED = { x: 0.2617994, y: 0.01, z: 0.2617994 };
const WINGS_OPEN = { x: 0.6981317, y: 0.08726646, z: Math.PI / 4 };

function wings(player, to) {
  const e = player.elytra;
  if (!e || !e.leftWing) return;
  const now = performance.now();
  const ticks = Math.min(TICKS, ((now - (e.userData.wingsAt || now)) / 1000) * TICKS);
  e.userData.wingsAt = now;
  const k = 1 - Math.pow(0.9, ticks);
  const r = e.leftWing.rotation;
  r.set(r.x + (to.x - r.x) * k, r.y + (to.y - r.y) * k, r.z + (to.z - r.z) * k);
  e.updateRightWing();
}

function rest(player) {
  const s = player.skin;
  for (const part of [s.head, s.body, s.rightArm, s.leftArm, s.rightLeg, s.leftLeg]) part.rotation.set(0, 0, 0);
  player.position.set(0, 0, 0);
  player.rotation.set(0, 0, 0);
}

export function mcIdle() {
  return new FunctionAnimation((player, t) => {
    const age = t * TICKS;
    rest(player);
    sway(player.skin, age);
    player.cape.rotation.x = 0.1 + Math.sin(age * 0.067) * 0.02;
    wings(player, WINGS_FOLDED);
  });
}

// amount: how wide the swing is (0.86 walking, 1 sprinting); pace: how fast it
// advances per second (the distance covered each tick, as the game counts it)
function stride(amount, pace) {
  return new FunctionAnimation((player, t) => {
    const age = t * TICKS;
    const swing = t * pace * 0.6662;
    const s = player.skin;
    rest(player);
    s.rightArm.rotation.x = Math.cos(swing + Math.PI) * amount;
    s.leftArm.rotation.x = Math.cos(swing) * amount;
    s.rightLeg.rotation.x = Math.cos(swing) * 1.4 * amount;
    s.leftLeg.rotation.x = Math.cos(swing + Math.PI) * 1.4 * amount;
    sway(s, age);
    // the cape lifts with speed and bounces with each step
    player.cape.rotation.x = 0.1 + amount * 0.75 + Math.sin(swing * 2) * 0.06;
    wings(player, amount >= 1 ? WINGS_OPEN : WINGS_FOLDED);
  });
}

export const mcWalk = () => stride(0.86, 17.3);
export const mcSprint = () => stride(1, 20);
