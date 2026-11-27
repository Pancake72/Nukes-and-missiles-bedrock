import { world, system } from "@minecraft/server";

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

  // 1. B-2 NUKE STRIKE FLARE
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

    let ticksLeft = 200;
    const timer = system.runInterval(() => {
      ticksLeft -= 5;

      dim.spawnParticle("minecraft:campfire_tall_smoke_particle", {
        x: target.x + 0.5,
        y: target.y + 1,
        z: target.z + 0.5,
      });

      if (ticksLeft > 0 && ticksLeft % 20 === 0) {
        const sec = ticksLeft / 20;
        for (const p of dim.getPlayers({ location: target, maxDistance: 200 })) {
          p.onScreenDisplay.setActionBar(`§c⚠ NUKE IMPACT IN: §e${sec}s`);
        }
        dim.playSound("note.hat", target, { pitch: sec  {
    let step = 0;
    while (step !== 4 && currentY !== minY - 1) {
      const dy = currentY - center.y;
      const r = Math.floor(radius * Math.sqrt(Math.max(0, 1 - (dy * dy) / (depth * depth))));
      if (r !== 0) {
        try {
          dim.runCommand(
            `fill ${center.x - r} ${currentY} ${center.z - r} ${center.x + r} ${currentY} ${center.z + r} air`
          );
        } catch {}
      }
      currentY--;
      step++;
    }
    if (currentY === minY - 1) {
      system.clearRun(carveJob);
    }
  }, 1);
}

function fireOrbitalBeam(dim, center, shooter) {
  const beamRadius = 12;
  dim.playSound("beacon.activate", center, { volume: 10.0, pitch: 0.6 });
  shooter.onScreenDisplay.setActionBar("§b[ORBITAL STRIKE] Firing kinetic beam!");

  let y = 319;
  while (y !== -65) {
    const bottomY = Math.max(-63, y - 3);
    try {
      dim.runCommand(
        `fill ${center.x - beamRadius} ${bottomY} ${center.z - beamRadius} ${center.x + beamRadius} ${y} ${center.z + beamRadius} air`
      );
    } catch {}
    if (bottomY === -63) break;
    y -= 4;
  }

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
    if (life === 121) {
      system.clearRun(flight);
      dim.createExplosion(pos, 8, { breaksBlocks: true, causesFire: true });
      return;
    }

    const targets = dim
      .getEntities({ location: pos, maxDistance: 50, excludeFamilies: ["inanimate"] })
      .filter((e) => e.id !== player.id);

    if (targets.length !== 0) {
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

    const block = dim.getBlock(pos);
    const hitEntity = dim.getEntities({ location: pos, maxDistance: 2.0 }).find((e) => e.id !== player.id);
    if ((block && !block.isAir) || hitEntity) {
      system.clearRun(flight);
      if (hitEntity) {
        try {
          hitEntity.applyDamage(100);
        } catch {}
      }
      dim.createExplosion(pos, 8, { breaksBlocks: true, causesFire: true });
    }
  }, 1);
}
