import { world, system } from "@minecraft/server";

// Track cooldowns per player
const cooldowns = new Map();

function checkCooldown(player, itemId, seconds) {
  const key = `${player.id}_${itemId}`;
  const now = system.currentTick;
  const readyTick = cooldowns.get(key) || 0;
  if (now < readyTick) {
    const left = Math.ceil((readyTick - now) / 20);
    player.onScreenDisplay.setActionBar(`§cCooldown: ${left}s remaining`);
    return false;
  }
  cooldowns.set(key, now + seconds * 20);
  return true;
}

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;
  if (!item) return;

  // 1. B-2 NUKE STRIKE FLARE (30s cooldown, 10s countdown, 150x200 crater)
  if (item.typeId === "nukes:nuke_flare") {
    if (!checkCooldown(player, "nuke_flare", 30)) return;
    const dim = player.dimension;
    const target = {
      x: Math.floor(player.location.x),
      y: Math.floor(player.location.y),
      z: Math.floor(player.location.z),
    };

    dim.playSound("firework.launch", target);
    player.onScreenDisplay.setActionBar("§c[B-2 AIRSTRIKE] Flare lit! Impact in 10 seconds...");

    let ticksLeft = 200; // 10 seconds
    const timer = system.runInterval(() => {
      ticksLeft -= 5;

      // Smoke flare column
      dim.spawnParticle("minecraft:campfire_tall_smoke_particle", {
        x: target.x + 0.5,
        y: target.y + 1,
        z: target.z + 0.5,
      });

      // Live countdown every 1 second (20 ticks)
      if (ticksLeft > 0 && ticksLeft % 20 === 0) {
        const sec = ticksLeft / 20;
        for (const p of dim.getPlayers({ location: target, maxDistance: 200 })) {
          p.onScreenDisplay.setActionBar(`§c⚠ NUKE IMPACT IN: §e${sec}s`);
        }
        dim.playSound("note.hat", target, { pitch: sec <= 3 ? 2.0 : 1.2 });
      }

      // B-2 roar at 2 seconds left
      if (ticksLeft === 40) {
        dim.playSound("mob.enderdragon.growl", target, { volume: 5.0, pitch: 0.5 });
      }

      // Impact at 0 seconds!
      if (ticksLeft <= 0) {
        system.clearRun(timer);
        detonateNuke(dim, target);
      }
    }, 5);
  }

  // 2. ORBITAL STRIKE DESIGNATOR (20s cooldown, 24-block wide sky-to-bedrock beam)
  if (item.typeId === "nukes:orbital_rod") {
    if (!checkCooldown(player, "orbital_rod", 20)) return;
    const hit = player.getBlockFromViewDirection({ maxDistance: 120 });
    if (!hit) {
      player.onScreenDisplay.setActionBar("§eAim at a block within 120 blocks!");
      return;
    }
    const target = hit.block.location;
    fireOrbitalBeam(player.dimension, target, player);
  }

  // 3. HOMING MISSILE LAUNCHER (3s cooldown, locks onto nearest target within 50 blocks)
  if (item.typeId === "nukes:missile_launcher") {
    if (!checkCooldown(player, "missile_launcher", 3)) return;
    launchHomingMissile(player);
  }
});

function detonateNuke(dim, center) {
  const radius = 75; // 150 diameter
  const depth = 200;
  dim.playSound("random.explode", center, { volume: 10.0, pitch: 0.4 });

  // Carve crater slice-by-slice across ticks so Minecraft Education never freezes
  let currentY = Math.min(319, center.y + 15);
  const minY = Math.max(-63, center.y - depth);

  const carveJob = system.runInterval(() => {
    for (let step = 0; step = -63; y -= 4) {
    try {
      dim.runCommand(`fill ${center.x - beamRadius} ${Math.max(-63, y - 3)} ${center.z - beamRadius} ${center.x + beamRadius} ${y} ${center.z + beamRadius} air`);
    } catch {}
  }

  // 9999 laser damage (protects shooter)
  for (const entity of dim.getEntities({ location: center, maxDistance: beamRadius + 4 })) {
    if (entity.id !== shooter.id) {
      try {
        entity.applyDamage(9999);
      } catch {}
    }
  }
}

function launchHomingMissile(player) {
  const dim = player.dimension;
  const view = player.getViewDirection();
  let pos = {
    x: player.location.x + view.x * 2,
    y: player.location.y + 1.5 + view.y * 2,
    z: player.location.z + view.z * 2,
  };
  let vel = { x: view.x * 1.5, y: view.y * 1.5, z: view.z * 1.5 };
  let life = 0;

  dim.playSound("firework.launch", pos);
  player.onScreenDisplay.setActionBar("§e[MISSILE AWAY] Tracking nearest target...");

  const flight = system.runInterval(() => {
    life++;
    if (life > 120) {
      system.clearRun(flight);
      dim.createExplosion(pos, 8, { breaksBlocks: true, causesFire: true });
      return;
    }

    // Find nearest target within 50 blocks (excluding shooter)
    const targets = dim
      .getEntities({ location: pos, maxDistance: 50, excludeFamilies: ["inanimate"] })
      .filter((e) => e.id !== player.id);

    if (targets.length > 0) {
      const target = targets[0];
      const dx = target.location.x - pos.x;
      const dy = target.location.y + 1 - pos.y;
      const dz = target.location.z - pos.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      vel = {
        x: vel.x * 0.7 + (dx / dist) * 1.5 * 0.3,
        y: vel.y * 0.7 + (dy / dist) * 1.5 * 0.3,
        z: vel.z * 0.7 + (dz / dist) * 1.5 * 0.3,
      };
    }

    pos = { x: pos.x + vel.x, y: pos.y + vel.y, z: pos.z + vel.z };
    dim.spawnParticle("minecraft:basic_flame_particle", pos);
    dim.spawnParticle("minecraft:campfire_smoke_particle", pos);

    // Check block or entity collision
    const block = dim.getBlock(pos);
    const hitEntity = dim.getEntities({ location: pos, maxDistance: 2.0 }).find((e) => e.id !== player.id);
    if ((block && !block.isAir) || hitEntity) {
      system.clearRun(flight);
      if (hitEntity) {
        try { hitEntity.applyDamage(100); } catch {}
      }
      dim.createExplosion(pos, 8, { breaksBlocks: true, causesFire: true });
    }
  }, 1);
}
