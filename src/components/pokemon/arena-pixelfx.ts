/**
 * Pixel-art effects (the open-source "pixelfx" library, copied into lib/pixelfx) played over the arena.
 *
 * Built to stay smooth:
 *  - one-shot effects (hits, blasts, KOs) are drawn live into a small canvas, about 30 times a second, and at most a few at once;
 *  - looping effects (shots in flight, status marks, pickups) are drawn ONCE into a strip of frames ("sheet"), a frame or two at a time,
 *    and after that cost one drawImage each, however many are on screen;
 *  - the full-screen weather is drawn live at a low frame rate and only while the game runs well;
 *  - a small governor watches the real frame time and switches the heavier things off in steps (tier 0 to 3), and back on when it recovers.
 */
// @ts-ignore — plain JS module
import { createFrame, clearFrame, createFx, composite } from "@/lib/pixelfx/core/index.js";

type Mod = { meta: { size: [number, number]; origin: [number, number]; duration: number; loop?: boolean; actor?: unknown; options?: { palette?: string[] } } };

const L = (p: Promise<unknown>) => p as Promise<Mod>;
const LOAD: Record<string, () => Promise<Mod>> = {
  "arcane/arcane-beam": () => L(import("@/lib/pixelfx/fx/arcane/arcane-beam.js")),
  "arcane/arcane-missiles": () => L(import("@/lib/pixelfx/fx/arcane/arcane-missiles.js")),
  "arcane/arcane-orb": () => L(import("@/lib/pixelfx/fx/arcane/arcane-orb.js")),
  "arcane/blink-in": () => L(import("@/lib/pixelfx/fx/arcane/blink-in.js")),
  "arcane/blink-out": () => L(import("@/lib/pixelfx/fx/arcane/blink-out.js")),
  "arcane/magic-circle-cast": () => L(import("@/lib/pixelfx/fx/arcane/magic-circle-cast.js")),
  "arcane/mana-burst": () => L(import("@/lib/pixelfx/fx/arcane/mana-burst.js")),
  "arcane/portal": () => L(import("@/lib/pixelfx/fx/arcane/portal.js")),
  "arcane/rune-circle": () => L(import("@/lib/pixelfx/fx/arcane/rune-circle.js")),
  "arcane/spell-charge": () => L(import("@/lib/pixelfx/fx/arcane/spell-charge.js")),
  "arcane/star-fall": () => L(import("@/lib/pixelfx/fx/arcane/star-fall.js")),
  "arcane/time-stop": () => L(import("@/lib/pixelfx/fx/arcane/time-stop.js")),
  "critters/bat": () => L(import("@/lib/pixelfx/fx/critters/bat.js")),
  "critters/bird": () => L(import("@/lib/pixelfx/fx/critters/bird.js")),
  "critters/butterfly": () => L(import("@/lib/pixelfx/fx/critters/butterfly.js")),
  "critters/eyeball": () => L(import("@/lib/pixelfx/fx/critters/eyeball.js")),
  "critters/fish-school": () => L(import("@/lib/pixelfx/fx/critters/fish-school.js")),
  "critters/flying-skull": () => L(import("@/lib/pixelfx/fx/critters/flying-skull.js")),
  "critters/frog": () => L(import("@/lib/pixelfx/fx/critters/frog.js")),
  "critters/ghost": () => L(import("@/lib/pixelfx/fx/critters/ghost.js")),
  "critters/jellyfish": () => L(import("@/lib/pixelfx/fx/critters/jellyfish.js")),
  "critters/slime": () => L(import("@/lib/pixelfx/fx/critters/slime.js")),
  "critters/snake": () => L(import("@/lib/pixelfx/fx/critters/snake.js")),
  "critters/wisp": () => L(import("@/lib/pixelfx/fx/critters/wisp.js")),
  "explosions/barrel-explosion": () => L(import("@/lib/pixelfx/fx/explosions/barrel-explosion.js")),
  "explosions/big-explosion": () => L(import("@/lib/pixelfx/fx/explosions/big-explosion.js")),
  "explosions/cartoon-pow": () => L(import("@/lib/pixelfx/fx/explosions/cartoon-pow.js")),
  "explosions/dirt-explosion": () => L(import("@/lib/pixelfx/fx/explosions/dirt-explosion.js")),
  "explosions/firework-burst": () => L(import("@/lib/pixelfx/fx/explosions/firework-burst.js")),
  "explosions/firework-rocket": () => L(import("@/lib/pixelfx/fx/explosions/firework-rocket.js")),
  "explosions/grenade": () => L(import("@/lib/pixelfx/fx/explosions/grenade.js")),
  "explosions/implosion": () => L(import("@/lib/pixelfx/fx/explosions/implosion.js")),
  "explosions/nuke": () => L(import("@/lib/pixelfx/fx/explosions/nuke.js")),
  "explosions/plasma-explosion": () => L(import("@/lib/pixelfx/fx/explosions/plasma-explosion.js")),
  "explosions/small-explosion": () => L(import("@/lib/pixelfx/fx/explosions/small-explosion.js")),
  "explosions/smoke-bomb": () => L(import("@/lib/pixelfx/fx/explosions/smoke-bomb.js")),
  "fire/brazier": () => L(import("@/lib/pixelfx/fx/fire/brazier.js")),
  "fire/campfire": () => L(import("@/lib/pixelfx/fx/fire/campfire.js")),
  "fire/candle": () => L(import("@/lib/pixelfx/fx/fire/candle.js")),
  "fire/fire-breath": () => L(import("@/lib/pixelfx/fx/fire/fire-breath.js")),
  "fire/fire-ring": () => L(import("@/lib/pixelfx/fx/fire/fire-ring.js")),
  "fire/fire-tornado": () => L(import("@/lib/pixelfx/fx/fire/fire-tornado.js")),
  "fire/fireball": () => L(import("@/lib/pixelfx/fx/fire/fireball.js")),
  "fire/flame-pillar": () => L(import("@/lib/pixelfx/fx/fire/flame-pillar.js")),
  "fire/flamethrower": () => L(import("@/lib/pixelfx/fx/fire/flamethrower.js")),
  "fire/meteor": () => L(import("@/lib/pixelfx/fx/fire/meteor.js")),
  "fire/spirit-flame": () => L(import("@/lib/pixelfx/fx/fire/spirit-flame.js")),
  "fire/torch": () => L(import("@/lib/pixelfx/fx/fire/torch.js")),
  "holy/blessing": () => L(import("@/lib/pixelfx/fx/holy/blessing.js")),
  "holy/divine-shield": () => L(import("@/lib/pixelfx/fx/holy/divine-shield.js")),
  "holy/feather-burst": () => L(import("@/lib/pixelfx/fx/holy/feather-burst.js")),
  "holy/halo": () => L(import("@/lib/pixelfx/fx/holy/halo.js")),
  "holy/heal-aoe": () => L(import("@/lib/pixelfx/fx/holy/heal-aoe.js")),
  "holy/heal": () => L(import("@/lib/pixelfx/fx/holy/heal.js")),
  "holy/holy-pillar": () => L(import("@/lib/pixelfx/fx/holy/holy-pillar.js")),
  "holy/resurrection": () => L(import("@/lib/pixelfx/fx/holy/resurrection.js")),
  "holy/smite": () => L(import("@/lib/pixelfx/fx/holy/smite.js")),
  "holy/sunburst": () => L(import("@/lib/pixelfx/fx/holy/sunburst.js")),
  "ice/blizzard-vortex": () => L(import("@/lib/pixelfx/fx/ice/blizzard-vortex.js")),
  "ice/freeze": () => L(import("@/lib/pixelfx/fx/ice/freeze.js")),
  "ice/frost-breath": () => L(import("@/lib/pixelfx/fx/ice/frost-breath.js")),
  "ice/frost-nova": () => L(import("@/lib/pixelfx/fx/ice/frost-nova.js")),
  "ice/ice-crystal": () => L(import("@/lib/pixelfx/fx/ice/ice-crystal.js")),
  "ice/ice-lance": () => L(import("@/lib/pixelfx/fx/ice/ice-lance.js")),
  "ice/ice-shatter": () => L(import("@/lib/pixelfx/fx/ice/ice-shatter.js")),
  "ice/ice-spikes": () => L(import("@/lib/pixelfx/fx/ice/ice-spikes.js")),
  "ice/icicle-fall": () => L(import("@/lib/pixelfx/fx/ice/icicle-fall.js")),
  "ice/snowflake-burst": () => L(import("@/lib/pixelfx/fx/ice/snowflake-burst.js")),
  "impacts/blunt-hit": () => L(import("@/lib/pixelfx/fx/impacts/blunt-hit.js")),
  "impacts/bullet-impact": () => L(import("@/lib/pixelfx/fx/impacts/bullet-impact.js")),
  "impacts/crit-hit": () => L(import("@/lib/pixelfx/fx/impacts/crit-hit.js")),
  "impacts/ground-slam": () => L(import("@/lib/pixelfx/fx/impacts/ground-slam.js")),
  "impacts/heavy-landing": () => L(import("@/lib/pixelfx/fx/impacts/heavy-landing.js")),
  "impacts/hit-flash": () => L(import("@/lib/pixelfx/fx/impacts/hit-flash.js")),
  "impacts/hit-spark": () => L(import("@/lib/pixelfx/fx/impacts/hit-spark.js")),
  "impacts/impact-frame": () => L(import("@/lib/pixelfx/fx/impacts/impact-frame.js")),
  "impacts/parry": () => L(import("@/lib/pixelfx/fx/impacts/parry.js")),
  "impacts/ricochet": () => L(import("@/lib/pixelfx/fx/impacts/ricochet.js")),
  "impacts/shield-block": () => L(import("@/lib/pixelfx/fx/impacts/shield-block.js")),
  "lightning/ball-lightning": () => L(import("@/lib/pixelfx/fx/lightning/ball-lightning.js")),
  "lightning/chain-lightning": () => L(import("@/lib/pixelfx/fx/lightning/chain-lightning.js")),
  "lightning/charge-up": () => L(import("@/lib/pixelfx/fx/lightning/charge-up.js")),
  "lightning/electrified": () => L(import("@/lib/pixelfx/fx/lightning/electrified.js")),
  "lightning/lightning-strike": () => L(import("@/lib/pixelfx/fx/lightning/lightning-strike.js")),
  "lightning/plasma-ball": () => L(import("@/lib/pixelfx/fx/lightning/plasma-ball.js")),
  "lightning/spark-arc": () => L(import("@/lib/pixelfx/fx/lightning/spark-arc.js")),
  "lightning/storm-cloud": () => L(import("@/lib/pixelfx/fx/lightning/storm-cloud.js")),
  "lightning/tesla-coil": () => L(import("@/lib/pixelfx/fx/lightning/tesla-coil.js")),
  "lightning/thunderclap": () => L(import("@/lib/pixelfx/fx/lightning/thunderclap.js")),
  "lightning/zap-hit": () => L(import("@/lib/pixelfx/fx/lightning/zap-hit.js")),
  "melee/claw-swipe": () => L(import("@/lib/pixelfx/fx/melee/claw-swipe.js")),
  "melee/dagger-flurry": () => L(import("@/lib/pixelfx/fx/melee/dagger-flurry.js")),
  "melee/double-slash": () => L(import("@/lib/pixelfx/fx/melee/double-slash.js")),
  "melee/hammer-smash": () => L(import("@/lib/pixelfx/fx/melee/hammer-smash.js")),
  "melee/heavy-cleave": () => L(import("@/lib/pixelfx/fx/melee/heavy-cleave.js")),
  "melee/scythe-reap": () => L(import("@/lib/pixelfx/fx/melee/scythe-reap.js")),
  "melee/spear-sweep": () => L(import("@/lib/pixelfx/fx/melee/spear-sweep.js")),
  "melee/spin-slash": () => L(import("@/lib/pixelfx/fx/melee/spin-slash.js")),
  "melee/sword-slash": () => L(import("@/lib/pixelfx/fx/melee/sword-slash.js")),
  "melee/thrust": () => L(import("@/lib/pixelfx/fx/melee/thrust.js")),
  "melee/uppercut": () => L(import("@/lib/pixelfx/fx/melee/uppercut.js")),
  "melee/whip-crack": () => L(import("@/lib/pixelfx/fx/melee/whip-crack.js")),
  "moves/arrow-shot": () => L(import("@/lib/pixelfx/fx/moves/arrow-shot.js")),
  "moves/dash-strike": () => L(import("@/lib/pixelfx/fx/moves/dash-strike.js")),
  "moves/earth-stomp": () => L(import("@/lib/pixelfx/fx/moves/earth-stomp.js")),
  "moves/fireball-throw": () => L(import("@/lib/pixelfx/fx/moves/fireball-throw.js")),
  "moves/ground-pound": () => L(import("@/lib/pixelfx/fx/moves/ground-pound.js")),
  "moves/holy-smite": () => L(import("@/lib/pixelfx/fx/moves/holy-smite.js")),
  "moves/ice-lance-throw": () => L(import("@/lib/pixelfx/fx/moves/ice-lance-throw.js")),
  "moves/lightning-call": () => L(import("@/lib/pixelfx/fx/moves/lightning-call.js")),
  "moves/meteor-call": () => L(import("@/lib/pixelfx/fx/moves/meteor-call.js")),
  "moves/pistol-shots": () => L(import("@/lib/pixelfx/fx/moves/pistol-shots.js")),
  "moves/rocket-launcher": () => L(import("@/lib/pixelfx/fx/moves/rocket-launcher.js")),
  "moves/sword-combo": () => L(import("@/lib/pixelfx/fx/moves/sword-combo.js")),
  "nature/acid-splash": () => L(import("@/lib/pixelfx/fx/nature/acid-splash.js")),
  "nature/boulder": () => L(import("@/lib/pixelfx/fx/nature/boulder.js")),
  "nature/earth-spike": () => L(import("@/lib/pixelfx/fx/nature/earth-spike.js")),
  "nature/healing-bloom": () => L(import("@/lib/pixelfx/fx/nature/healing-bloom.js")),
  "nature/leaf-storm": () => L(import("@/lib/pixelfx/fx/nature/leaf-storm.js")),
  "nature/poison-cloud": () => L(import("@/lib/pixelfx/fx/nature/poison-cloud.js")),
  "nature/quake": () => L(import("@/lib/pixelfx/fx/nature/quake.js")),
  "nature/root-snare": () => L(import("@/lib/pixelfx/fx/nature/root-snare.js")),
  "nature/spore-burst": () => L(import("@/lib/pixelfx/fx/nature/spore-burst.js")),
  "nature/thorns": () => L(import("@/lib/pixelfx/fx/nature/thorns.js")),
  "nature/tornado": () => L(import("@/lib/pixelfx/fx/nature/tornado.js")),
  "nature/toxic-puddle": () => L(import("@/lib/pixelfx/fx/nature/toxic-puddle.js")),
  "nature/vine-whip": () => L(import("@/lib/pixelfx/fx/nature/vine-whip.js")),
  "pickups/chest-open": () => L(import("@/lib/pixelfx/fx/pickups/chest-open.js")),
  "pickups/coin-spin": () => L(import("@/lib/pixelfx/fx/pickups/coin-spin.js")),
  "pickups/collect-burst": () => L(import("@/lib/pixelfx/fx/pickups/collect-burst.js")),
  "pickups/crystal-shard": () => L(import("@/lib/pixelfx/fx/pickups/crystal-shard.js")),
  "pickups/gem-spin": () => L(import("@/lib/pixelfx/fx/pickups/gem-spin.js")),
  "pickups/heart-pickup": () => L(import("@/lib/pixelfx/fx/pickups/heart-pickup.js")),
  "pickups/key-glint": () => L(import("@/lib/pixelfx/fx/pickups/key-glint.js")),
  "pickups/loot-beam": () => L(import("@/lib/pixelfx/fx/pickups/loot-beam.js")),
  "pickups/potion": () => L(import("@/lib/pixelfx/fx/pickups/potion.js")),
  "pickups/power-star": () => L(import("@/lib/pixelfx/fx/pickups/power-star.js")),
  "pickups/xp-orb": () => L(import("@/lib/pixelfx/fx/pickups/xp-orb.js")),
  "projectiles/arrow": () => L(import("@/lib/pixelfx/fx/projectiles/arrow.js")),
  "projectiles/bullet-tracer": () => L(import("@/lib/pixelfx/fx/projectiles/bullet-tracer.js")),
  "projectiles/cannonball": () => L(import("@/lib/pixelfx/fx/projectiles/cannonball.js")),
  "projectiles/energy-disc": () => L(import("@/lib/pixelfx/fx/projectiles/energy-disc.js")),
  "projectiles/water-shuriken": () => L(import("@/lib/pixelfx/fx/projectiles/water-shuriken.js")),
  "projectiles/flare": () => L(import("@/lib/pixelfx/fx/projectiles/flare.js")),
  "projectiles/homing-missile": () => L(import("@/lib/pixelfx/fx/projectiles/homing-missile.js")),
  "projectiles/laser-bolt": () => L(import("@/lib/pixelfx/fx/projectiles/laser-bolt.js")),
  "projectiles/magic-missile": () => L(import("@/lib/pixelfx/fx/projectiles/magic-missile.js")),
  "projectiles/muzzle-pistol": () => L(import("@/lib/pixelfx/fx/projectiles/muzzle-pistol.js")),
  "projectiles/muzzle-shotgun": () => L(import("@/lib/pixelfx/fx/projectiles/muzzle-shotgun.js")),
  "projectiles/muzzle-smg": () => L(import("@/lib/pixelfx/fx/projectiles/muzzle-smg.js")),
  "projectiles/plasma-shot": () => L(import("@/lib/pixelfx/fx/projectiles/plasma-shot.js")),
  "projectiles/rocket": () => L(import("@/lib/pixelfx/fx/projectiles/rocket.js")),
  "scifi/emp-blast": () => L(import("@/lib/pixelfx/fx/scifi/emp-blast.js")),
  "scifi/energy-core": () => L(import("@/lib/pixelfx/fx/scifi/energy-core.js")),
  "scifi/force-field": () => L(import("@/lib/pixelfx/fx/scifi/force-field.js")),
  "scifi/glitch": () => L(import("@/lib/pixelfx/fx/scifi/glitch.js")),
  "scifi/hologram": () => L(import("@/lib/pixelfx/fx/scifi/hologram.js")),
  "scifi/jetpack": () => L(import("@/lib/pixelfx/fx/scifi/jetpack.js")),
  "scifi/laser-grid": () => L(import("@/lib/pixelfx/fx/scifi/laser-grid.js")),
  "scifi/scanner": () => L(import("@/lib/pixelfx/fx/scifi/scanner.js")),
  "scifi/teleporter-pad": () => L(import("@/lib/pixelfx/fx/scifi/teleporter-pad.js")),
  "scifi/tractor-beam": () => L(import("@/lib/pixelfx/fx/scifi/tractor-beam.js")),
  "scifi/warp-in": () => L(import("@/lib/pixelfx/fx/scifi/warp-in.js")),
  "scifi/warp-out": () => L(import("@/lib/pixelfx/fx/scifi/warp-out.js")),
  "shadow/black-hole": () => L(import("@/lib/pixelfx/fx/shadow/black-hole.js")),
  "shadow/curse": () => L(import("@/lib/pixelfx/fx/shadow/curse.js")),
  "shadow/dark-explosion": () => L(import("@/lib/pixelfx/fx/shadow/dark-explosion.js")),
  "shadow/eclipse": () => L(import("@/lib/pixelfx/fx/shadow/eclipse.js")),
  "shadow/grasping-hands": () => L(import("@/lib/pixelfx/fx/shadow/grasping-hands.js")),
  "shadow/hex-sigil": () => L(import("@/lib/pixelfx/fx/shadow/hex-sigil.js")),
  "shadow/life-steal": () => L(import("@/lib/pixelfx/fx/shadow/life-steal.js")),
  "shadow/necro-skulls": () => L(import("@/lib/pixelfx/fx/shadow/necro-skulls.js")),
  "shadow/shadow-flames": () => L(import("@/lib/pixelfx/fx/shadow/shadow-flames.js")),
  "shadow/shadow-tendrils": () => L(import("@/lib/pixelfx/fx/shadow/shadow-tendrils.js")),
  "shadow/soul-drain": () => L(import("@/lib/pixelfx/fx/shadow/soul-drain.js")),
  "shadow/void-orb": () => L(import("@/lib/pixelfx/fx/shadow/void-orb.js")),
  "spawn/coin-drop": () => L(import("@/lib/pixelfx/fx/spawn/coin-drop.js")),
  "spawn/disintegrate": () => L(import("@/lib/pixelfx/fx/spawn/disintegrate.js")),
  "spawn/dissolve-burn": () => L(import("@/lib/pixelfx/fx/spawn/dissolve-burn.js")),
  "spawn/egg-hatch": () => L(import("@/lib/pixelfx/fx/spawn/egg-hatch.js")),
  "spawn/poof": () => L(import("@/lib/pixelfx/fx/spawn/poof.js")),
  "spawn/respawn-beam": () => L(import("@/lib/pixelfx/fx/spawn/respawn-beam.js")),
  "spawn/shatter-death": () => L(import("@/lib/pixelfx/fx/spawn/shatter-death.js")),
  "spawn/soul-rise": () => L(import("@/lib/pixelfx/fx/spawn/soul-rise.js")),
  "spawn/spawn-portal": () => L(import("@/lib/pixelfx/fx/spawn/spawn-portal.js")),
  "spawn/summon-rise": () => L(import("@/lib/pixelfx/fx/spawn/summon-rise.js")),
  "status/bleeding": () => L(import("@/lib/pixelfx/fx/status/bleeding.js")),
  "status/burning": () => L(import("@/lib/pixelfx/fx/status/burning.js")),
  "status/charmed": () => L(import("@/lib/pixelfx/fx/status/charmed.js")),
  "status/confused": () => L(import("@/lib/pixelfx/fx/status/confused.js")),
  "status/cursed": () => L(import("@/lib/pixelfx/fx/status/cursed.js")),
  "status/frozen": () => L(import("@/lib/pixelfx/fx/status/frozen.js")),
  "status/haste": () => L(import("@/lib/pixelfx/fx/status/haste.js")),
  "status/petrified": () => L(import("@/lib/pixelfx/fx/status/petrified.js")),
  "status/poisoned": () => L(import("@/lib/pixelfx/fx/status/poisoned.js")),
  "status/rage": () => L(import("@/lib/pixelfx/fx/status/rage.js")),
  "status/sleep": () => L(import("@/lib/pixelfx/fx/status/sleep.js")),
  "status/slowed": () => L(import("@/lib/pixelfx/fx/status/slowed.js")),
  "status/stunned": () => L(import("@/lib/pixelfx/fx/status/stunned.js")),
  "ui/achievement": () => L(import("@/lib/pixelfx/fx/ui/achievement.js")),
  "ui/coin-collect": () => L(import("@/lib/pixelfx/fx/ui/coin-collect.js")),
  "ui/combo-counter": () => L(import("@/lib/pixelfx/fx/ui/combo-counter.js")),
  "ui/confetti": () => L(import("@/lib/pixelfx/fx/ui/confetti.js")),
  "ui/countdown": () => L(import("@/lib/pixelfx/fx/ui/countdown.js")),
  "ui/crit-number": () => L(import("@/lib/pixelfx/fx/ui/crit-number.js")),
  "ui/damage-number": () => L(import("@/lib/pixelfx/fx/ui/damage-number.js")),
  "ui/exclamation": () => L(import("@/lib/pixelfx/fx/ui/exclamation.js")),
  "ui/health-bar-hit": () => L(import("@/lib/pixelfx/fx/ui/health-bar-hit.js")),
  "ui/heart-lost": () => L(import("@/lib/pixelfx/fx/ui/heart-lost.js")),
  "ui/level-up": () => L(import("@/lib/pixelfx/fx/ui/level-up.js")),
  "ui/quest-complete": () => L(import("@/lib/pixelfx/fx/ui/quest-complete.js")),
  "water/bubbles": () => L(import("@/lib/pixelfx/fx/water/bubbles.js")),
  "water/drip": () => L(import("@/lib/pixelfx/fx/water/drip.js")),
  "water/fountain": () => L(import("@/lib/pixelfx/fx/water/fountain.js")),
  "water/geyser": () => L(import("@/lib/pixelfx/fx/water/geyser.js")),
  "water/rain-splash": () => L(import("@/lib/pixelfx/fx/water/rain-splash.js")),
  "water/ripples": () => L(import("@/lib/pixelfx/fx/water/ripples.js")),
  "water/splash": () => L(import("@/lib/pixelfx/fx/water/splash.js")),
  "water/water-jet": () => L(import("@/lib/pixelfx/fx/water/water-jet.js")),
  "water/water-orb": () => L(import("@/lib/pixelfx/fx/water/water-orb.js")),
  "water/waterfall": () => L(import("@/lib/pixelfx/fx/water/waterfall.js")),
  "water/wave-crash": () => L(import("@/lib/pixelfx/fx/water/wave-crash.js")),
  "water/whirlpool": () => L(import("@/lib/pixelfx/fx/water/whirlpool.js")),
  "weather/aurora": () => L(import("@/lib/pixelfx/fx/weather/aurora.js")),
  "weather/blizzard": () => L(import("@/lib/pixelfx/fx/weather/blizzard.js")),
  "weather/cherry-blossoms": () => L(import("@/lib/pixelfx/fx/weather/cherry-blossoms.js")),
  "weather/clouds": () => L(import("@/lib/pixelfx/fx/weather/clouds.js")),
  "weather/falling-leaves": () => L(import("@/lib/pixelfx/fx/weather/falling-leaves.js")),
  "weather/fireflies": () => L(import("@/lib/pixelfx/fx/weather/fireflies.js")),
  "weather/fog": () => L(import("@/lib/pixelfx/fx/weather/fog.js")),
  "weather/god-rays": () => L(import("@/lib/pixelfx/fx/weather/god-rays.js")),
  "weather/rain": () => L(import("@/lib/pixelfx/fx/weather/rain.js")),
  "weather/shooting-stars": () => L(import("@/lib/pixelfx/fx/weather/shooting-stars.js")),
  "weather/snow": () => L(import("@/lib/pixelfx/fx/weather/snow.js")),
  "weather/storm": () => L(import("@/lib/pixelfx/fx/weather/storm.js")),
};
export type PxId = keyof typeof LOAD;

export type PxOpts = {
  /** World units per effect pixel. */
  scale: number;
  flip?: boolean;
  angle?: number;
  /** Recolour it with a dark-to-bright ramp made from this colour. */
  tint?: string;
  /** Play faster (long effects have slow tails). */
  speed?: number;
  /** Stop after this many seconds (it fades out). */
  max?: number;
  /** Lift it off the floor (body height), in world units. */
  lift?: number;
  /** Extra options for the effect itself (a label, a count…). */
  extra?: Record<string, unknown>;
  /** Hold it back this many seconds before it starts. */
  delay?: number;
};

const cache = new Map<string, Mod>();
const loading = new Set<string>();

/** Where the target stands in a melee effect (effect pixels from its origin), so the strike can be laid on the one that was hit. */
/**
 * The effects are built on a small pixel grid. To keep them from looking like blocks, they are enlarged here in a way that rounds the
 * stair-steps off: twice the size with smooth sampling, then a very slight blur (only where the browser supports canvas filters).
 */
function smoothUp(src: HTMLCanvasElement, dst?: HTMLCanvasElement): HTMLCanvasElement {
  const out = dst ?? document.createElement("canvas");
  if (out.width !== src.width * 2) { out.width = src.width * 2; out.height = src.height * 2; }
  const g = out.getContext("2d")!;
  g.clearRect(0, 0, out.width, out.height);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  try { if ("filter" in g) g.filter = "blur(0.7px)"; } catch { /* no canvas filters: the smooth sampling alone is used */ }
  g.drawImage(src, 0, 0, out.width, out.height);
  try { if ("filter" in g) g.filter = "none"; } catch { /* */ }
  return out;
}

export function targetX(id: string): number {
  const m = cache.get(id) as { act?: { target?: { x?: number }; targets?: { x?: number }[] } } | undefined;
  return m?.act?.target?.x ?? m?.act?.targets?.[0]?.x ?? 0;
}

/** The small, common effects every match uses; the rest load when a fighter's moves call for them. */
const COMMON = ["impacts/", "status/", "pickups/", "spawn/", "ui/combo", "ui/quest", "explosions/small", "explosions/big", "explosions/dirt", "explosions/plasma", "water/splash", "water/geyser", "water/water-orb", "water/water-jet", "lightning/zap-hit", "nature/spore", "nature/acid", "nature/healing", "ice/snowflake", "ice/frost-breath", "shadow/dark-explosion", "arcane/mana-burst", "arcane/arcane-beam", "arcane/star-fall", "holy/feather", "holy/smite", "scifi/emp", "fire/fireball", "fire/flamethrower", "projectiles/"];

/** Start loading effects so the first one of a match doesn't wait. With no list it loads the small, common ones. */
export function preloadPixelfx(ids?: string[]) {
  for (const id of ids ?? Object.keys(LOAD).filter((k) => COMMON.some((c) => k.startsWith(c)))) {
    if (cache.has(id) || loading.has(id)) continue;
    loading.add(id);
    LOAD[id]!().then((m) => cache.set(id, m)).catch(() => {}).finally(() => loading.delete(id));
  }
}

const hx = (s: string) => {
  const n = parseInt(s.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
/** Colours from near-black to white that pass through the given colour in the middle. */
export function rampOf(color: string, n = 7): string[] {
  const [r, g, b] = hx(color);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const k = u < 0.55 ? u / 0.55 : 1;
    const w = u < 0.55 ? 0 : (u - 0.55) / 0.45;
    const c = [r, g, b].map((v) => Math.round(v * (0.12 + 0.88 * k) + (255 - v) * w * 0.85));
    out.push("#" + c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join(""));
  }
  return out;
}

/** A stand-in body for the status marks to hug: a plump creature, 26 x 30 pixels, feet at the origin. */
let BLOB: unknown = null;
function blobActor() {
  if (BLOB) return BLOB;
  const w = 26, h = 30, data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const bx = (x - 12.5) / 12.5, by = (y - 19.5) / 10.5; // the body
      const hx2 = (x - 12.5) / 7.5, hy = (y - 7.5) / 7.5; // the head
      if (bx * bx + by * by <= 1 || hx2 * hx2 + hy * hy <= 1) data[y * w + x] = 1;
    }
  BLOB = { mask: { w, h, data }, pixels: null, x: -13, y: -h, w, h, k: 2, head: [0, -h], chest: [0, -16] };
  return BLOB;
}

/** A stand-in body from a silhouette: `data` is 1 where the Pokémon is, w x h pixels, feet at the bottom middle. */
export function actorFromMask(w: number, h: number, data: Uint8Array, pix?: Uint32Array) {
  return { mask: { w, h, data }, pixels: pix ?? null, x: -Math.floor(w / 2), y: -h, w, h, k: 2, head: [0, -h + 2], chest: [0, -Math.round(h * 0.5)] };
}

type Live = {
  fx: ReturnType<typeof createFx>;
  frame: ReturnType<typeof createFrame>;
  img: ImageData;
  cv: HTMLCanvasElement;
  cx: CanvasRenderingContext2D;
  ox: number;
  oy: number;
  x: number;
  y: number;
  o: PxOpts;
  t: number;
  life: number;
  acc: number;
  dirty: boolean;
  big?: HTMLCanvasElement; // the same picture enlarged smoothly (see smoothUp)
  stopped: boolean;
  /** seconds still to wait before it starts */
  wait: number;
};

/** A loop drawn once into a strip of frames. */
export type Sheet = {
  key: string;
  w: number;
  h: number;
  ox: number;
  oy: number;
  n: number;
  fps: number;
  frames: HTMLCanvasElement[];
  ready: boolean;
  bad: boolean;
  fx: ReturnType<typeof createFx> | null;
  frame: ReturnType<typeof createFrame> | null;
  img: ImageData | null;
  mod: Mod;
  step: number;
  used: number;
};

const STEP = 1 / 30;
const MAX_SHEETS = 140;

export class PixelFxLayer {
  live: Live[] = [];
  sheets = new Map<string, Sheet>();
  private queue: Sheet[] = [];
  private useClock = 0;

  /** Drop the sheet that has gone unused the longest (never one that is still being drawn). */
  private evict() {
    let old: Sheet | null = null;
    for (const sh of this.sheets.values()) if (sh.ready && (!old || sh.used < old.used)) old = sh;
    if (!old) return false;
    this.sheets.delete(old.key);
    return true;
  }

  /** A sheet that exists and is ready, without starting one. */
  peek(id: PxId, tint?: string, bodyKey?: string): Sheet | null {
    const sh = this.sheets.get(id + "|" + (tint ?? "") + (bodyKey ? "|" + bodyKey : ""));
    return sh?.ready ? sh : null;
  }

  /** 0: everything. 1: no weather. 2: also no status marks or pickups, fewer one-shots. 3: only shots and hits. */
  tier = 0;
  private ema = 16;
  private slowFor = 0;
  private fastFor = 0;
  /** Milliseconds spent by this layer in the last second, for a quick check. */
  ms = 0;
  private msAcc = 0;
  private msT = 0;

  get cap() {
    return [8, 6, 4, 3][this.tier]!;
  }

  /** Watch the real frame time and move between tiers. Call once a frame with the real elapsed seconds. */
  govern(dtRaw: number) {
    if (!(dtRaw > 0) || dtRaw > 0.5) return; // a pause or a tab switch says nothing
    this.ema += (dtRaw * 1000 - this.ema) * 0.06;
    if (this.ema > 26) {
      this.slowFor += dtRaw;
      this.fastFor = 0;
      if (this.slowFor > 1.2 && this.tier < 3) {
        this.tier++;
        this.slowFor = 0;
        this.trim();
      }
    } else if (this.ema < 19) {
      this.fastFor += dtRaw;
      this.slowFor = 0;
      if (this.fastFor > 8 && this.tier > 0) {
        this.tier--;
        this.fastFor = 0;
      }
    } else {
      this.slowFor = this.fastFor = 0;
    }
  }

  private trim() {
    while (this.live.length > this.cap) this.live.shift();
    if (this.tier >= 1) this.weather = null;
  }

  /** Play an effect with its origin at world (x, y). Does nothing until the effect has loaded. */
  spawn(id: PxId, x: number, y: number, o: PxOpts) {
    const mod = cache.get(id);
    if (!mod) {
      preloadPixelfx([id]);
      return;
    }
    if (typeof document === "undefined") return;
    const [w, h] = mod.meta.size;
    const [ox, oy] = mod.meta.origin;
    const opts: Record<string, unknown> = { x: ox, y: oy, seed: (Math.random() * 1e6) | 0, flip: !!o.flip, angle: o.angle ?? 0, ...(o.extra ?? {}) };
    if (o.tint && mod.meta.options?.palette) opts.palette = rampOf(o.tint, mod.meta.options.palette.length);
    const fx = createFx(mod, opts);
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const cx = cv.getContext("2d");
    if (!cx) return;
    const speed = o.speed ?? 1;
    const life = Math.min(mod.meta.duration / speed, o.max ?? 99);
    this.live.push({ fx, frame: createFrame(w, h), img: new ImageData(w, h), cv, cx, ox, oy, x, y, o, t: 0, life, acc: STEP, dirty: true, stopped: false, wait: o.delay ?? 0 });
    while (this.live.length > this.cap) this.live.shift();
  }

  /* ------------------------------------------------------------ sheets */

  /**
   * The looping effect `id`, drawn into frames. Returns it at once; `ready` turns true once every frame is drawn
   * (a frame or two at a time, see pump). `blob` makes the status marks hug a stand-in body.
   */
  sheet(id: PxId, tint?: string, body?: { key: string; actor: () => unknown }): Sheet | null {
    const key = id + "|" + (tint ?? "") + (body ? "|" + body.key : "");
    const got = this.sheets.get(key);
    if (got) {
      got.used = ++this.useClock;
      return got.bad ? null : got;
    }
    const mod = cache.get(id);
    if (!mod) {
      preloadPixelfx([id]);
      return null;
    }
    if (typeof document === "undefined") return null;
    if (this.sheets.size >= MAX_SHEETS && !this.evict()) return null;
    const [w, h] = mod.meta.size;
    const [ox, oy] = mod.meta.origin;
    const n = Math.max(8, Math.min(24, Math.round(mod.meta.duration * 12)));
    const opts: Record<string, unknown> = { x: ox, y: oy, seed: 3 };
    if (mod.meta.actor) opts.actor = body ? body.actor() : blobActor();
    if (tint && mod.meta.options?.palette) opts.palette = rampOf(tint, mod.meta.options.palette.length);
    let fx: ReturnType<typeof createFx> | null = null;
    try {
      fx = createFx(mod, opts);
    } catch {
      fx = null;
    }
    const sh: Sheet = { key, w, h, ox, oy, n, fps: n / mod.meta.duration, frames: [], ready: false, bad: !fx, fx, frame: fx ? createFrame(w, h) : null, img: fx ? new ImageData(w, h) : null, mod, step: 0, used: ++this.useClock };
    this.sheets.set(key, sh);
    if (fx) this.queue.push(sh);
    return sh.bad ? null : sh;
  }

  /** Draw frames of the sheets that are still being made, for at most `ms` milliseconds (always at least one). */
  pump(ms: number) {
    const t0 = performance.now();
    while (this.queue.length) {
      const sh = this.queue[0]!;
      try {
        const sub = sh.mod.meta.duration / sh.n;
        for (let u = sub; u > 1e-6; u -= STEP) sh.fx!.update(Math.min(STEP, u)); // advance in small steps, as the effect expects
        clearFrame(sh.frame);
        sh.fx!.draw(sh.frame);
        composite(sh.frame, sh.img!.data, null);
        const cv = document.createElement("canvas");
        cv.width = sh.w;
        cv.height = sh.h;
        cv.getContext("2d")!.putImageData(sh.img!, 0, 0);
        sh.frames.push(smoothUp(cv));
      } catch {
        sh.bad = true;
        this.queue.shift();
        continue;
      }
      if (sh.frames.length >= sh.n) {
        sh.ready = true;
        sh.fx = sh.frame = sh.img = null;
        this.queue.shift();
      }
      if (performance.now() - t0 >= ms) break;
    }
    this.msAcc += performance.now() - t0;
  }

  /** Draw a ready sheet at the current origin: its own origin lands there, `k` world units per pixel, `t` seconds into the loop. */
  drawSheet(g: CanvasRenderingContext2D, sh: Sheet, t: number, k: number, angle = 0, flip = false, dx = 0, dy = 0) {
    if (!sh.ready) return false;
    const f = sh.frames[Math.floor(t * sh.fps) % sh.n]!;
    g.save();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; // smooth, not blocky: the art is built small and enlarged
    if (angle) g.rotate(angle);
    if (flip) g.scale(-1, 1);
    g.drawImage(f, -sh.ox * k + dx, -sh.oy * k + dy, sh.w * k, sh.h * k);
    g.restore();
    return true;
  }

  /* ------------------------------------------------------------ weather */

  private weather: { id: string; fx: ReturnType<typeof createFx>; frame: ReturnType<typeof createFrame>; img: ImageData; cv: HTMLCanvasElement; cx: CanvasRenderingContext2D; acc: number } | null = null;
  private weatherId = "";

  /** Which weather to run (null for none). It only runs at tier 0. */
  setWeather(id: PxId | null, tint?: string) {
    const want = this.tier === 0 && id ? id + "|" + (tint ?? "") : "";
    if (want === this.weatherId) return;
    this.weatherId = want;
    this.weather = null;
    if (!want || !id || typeof document === "undefined") return;
    const mod = cache.get(id);
    if (!mod) {
      preloadPixelfx([id]);
      this.weatherId = ""; // try again next time
      return;
    }
    const [w, h] = mod.meta.size;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const cx = cv.getContext("2d");
    if (!cx) return;
    const opts: Record<string, unknown> = { x: mod.meta.origin[0], y: mod.meta.origin[1], seed: 11 };
    if (tint && mod.meta.options?.palette) opts.palette = rampOf(tint, mod.meta.options.palette.length);
    this.weather = { id, fx: createFx(mod, opts), frame: createFrame(w, h), img: new ImageData(w, h), cv, cx, acc: 1 };
  }

  get hasWeather() {
    return !!this.weather && this.tier === 0;
  }

  /** The weather over the whole screen (the picture is stretched across it). */
  drawWeather(g: CanvasRenderingContext2D, W: number, H: number, alpha = 1) {
    const wx = this.weather;
    if (!wx || this.tier > 0) return;
    g.save();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; // smooth, not blocky: the art is built small and enlarged
    g.globalAlpha *= alpha;
    g.drawImage(wx.cv, 0, 0, W, H);
    g.restore();
  }

  /* ------------------------------------------------------------ update and draw */

  update(dt: number) {
    const t0 = performance.now();
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i]!;
      if (l.wait > 0) {
        l.wait -= dt;
        continue;
      }
      l.t += dt;
      l.acc += dt;
      if (!l.stopped && l.t >= l.life) {
        l.fx.stop();
        l.stopped = true;
      }
      if (l.t >= l.life + 0.35 || l.fx.done()) {
        this.live.splice(i, 1);
        continue;
      }
      if (l.acc >= STEP) {
        // the effect keeps its own clock; a picture is only redrawn about 30 times a second
        l.fx.update(l.acc * (l.o.speed ?? 1));
        l.acc = 0;
        l.dirty = true;
      }
    }
    const wx = this.weather;
    if (wx && this.tier === 0) {
      wx.acc += dt;
      if (wx.acc >= 0.1) {
        // weather moves slowly: ten pictures a second is plenty, and it is the costliest thing here
        wx.fx.update(Math.min(wx.acc, 0.2));
        wx.acc = 0;
        clearFrame(wx.frame);
        wx.fx.draw(wx.frame);
        composite(wx.frame, wx.img.data, null);
        wx.cx.putImageData(wx.img, 0, 0);
      }
    }
    this.msAcc += performance.now() - t0;
    this.msT += dt;
    if (this.msT >= 1) {
      this.ms = this.msAcc / this.msT;
      this.msAcc = this.msT = 0;
    }
  }

  private paint(l: Live) {
    if (!l.dirty) return;
    const t0 = performance.now();
    clearFrame(l.frame);
    l.fx.draw(l.frame);
    composite(l.frame, l.img.data, null);
    l.cx.putImageData(l.img, 0, 0);
    if (this.tier < 2) l.big = smoothUp(l.cv, l.big);
    else l.big = undefined;
    l.dirty = false;
    this.msAcc += performance.now() - t0;
  }

  /** What to put among the sorted things: one entry per live effect. `draw` runs with the world position already set. */
  items(add: (x: number, y: number, lift: number, draw: (g: CanvasRenderingContext2D) => void) => void) {
    for (const l of this.live) {
      if (l.wait > 0) continue;
      add(l.x, l.y, l.o.lift ?? 0, (g) => {
        this.paint(l);
        const k = l.o.scale;
        g.save();
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; // smooth, not blocky: the art is built small and enlarged
        g.drawImage(l.big ?? l.cv, -l.ox * k, -l.oy * k, l.cv.width * k, l.cv.height * k);
        g.restore();
      });
    }
  }

  clear() {
    this.live.length = 0;
    this.weather = null;
    this.weatherId = "";
  }
}
