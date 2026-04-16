'use strict';

// ─── Camera ───────────────────────────────────────────────────────────────────
function getCamera(player) {
  const worldW = MAP_W * TILE, worldH = MAP_H * TILE;
  // Allow camera overscroll near edges so player remains visible under minimap / touch controls
  const leftPad = 5 * TILE;
  const rightPad = Math.max(5 * TILE, 130 + safeRight);
  const topPad = Math.max(5 * TILE, 92 + safeTop);
  const bottomPad = 5 * TILE;
  const camX = W >= worldW
    ? -(W - worldW) / 2
    : clamp(player.x * TILE - W / 2, -leftPad, worldW - W + rightPad);
  const botClear = layout.hudH / 2;
  const camY = H >= worldH
    ? -(H - worldH) / 2
    : clamp(player.y * TILE - H / 2 + botClear, -topPad, worldH - H + botClear + bottomPad);
  return { x: camX, y: camY };
}

// ─── Renderer ─────────────────────────────────────────────────────────────────
function drawWorld(dungeon, camX, camY) {
  const startX=Math.max(0,Math.floor(camX/TILE)-1);
  const startY=Math.max(0,Math.floor(camY/TILE)-1);
  const endX=Math.min(MAP_W,startX+Math.ceil(W/TILE)+2);
  const endY=Math.min(MAP_H,startY+Math.ceil((H-layout.hudH)/TILE)+2);

  for (let ty=startY; ty<endY; ty++) {
    for (let tx=startX; tx<endX; tx++) {
      const tile=dungeon.map[ty][tx];
      const vis=dungeon.visited[ty][tx];
      if (!vis) continue;
      const lv=dungeon.light[ty][tx];
      const brightness=lv>0 ? Math.max(0.55,lv) : 0.35;
      const sx=tx*TILE-camX, sy=ty*TILE-camY;

      ctx.save();
      ctx.globalAlpha=brightness;
      switch(tile) {
        case T.WALL: {
          const isSealed = (game.bossSealed && game.bossEntrances.some(e=>e.x===tx&&e.y===ty)) ||
                           (game.challengeSealed && game.challengeEntrances.some(e=>e.x===tx&&e.y===ty));
          ctx.fillStyle = isSealed ? '#3d2828' : '#3a3a6a';
          ctx.fillRect(sx,sy,TILE,TILE);
          ctx.fillStyle = isSealed ? '#724040' : '#5858a0';
          ctx.fillRect(sx,sy,TILE,2);
          ctx.fillRect(sx,sy,2,TILE);
          if (isSealed) {
            ctx.shadowBlur=8; ctx.shadowColor='#ff3333';
            ctx.fillStyle='#ff3333';
            ctx.globalAlpha=brightness*0.4;
            ctx.fillRect(sx+2,sy+2,TILE-4,TILE-4);
          }
          break;
        }
        case T.FLOOR: {
          const rc = dungeon.roomColour[ty]?.[tx];
          ctx.fillStyle = rc || '#252545';
          ctx.fillRect(sx,sy,TILE,TILE);
          if ((tx+ty)%4===0) { ctx.fillStyle= rc ? '#0e0e0e' : '#303058'; ctx.globalAlpha=brightness*0.3; ctx.fillRect(sx,sy,TILE,TILE); }
          break;
        }
        case T.STAIRS:
          ctx.fillStyle='#252545';
          ctx.fillRect(sx,sy,TILE,TILE);
          ctx.globalAlpha=brightness;
          ctx.shadowBlur=8; ctx.shadowColor='#ffff00';
          ctx.fillStyle='#ffff00';
          ctx.font='18px monospace';
          ctx.fillText('▼',sx+5,sy+20);
          break;
        case T.TERMINAL:
          ctx.fillStyle='#252545';
          ctx.fillRect(sx,sy,TILE,TILE);
          ctx.shadowBlur=12; ctx.shadowColor='#00f5ff';
          ctx.fillStyle='#00f5ff';
          ctx.font='16px monospace';
          ctx.fillText('⬡',sx+4,sy+20);
          break;
        case T.VENDOR:
          ctx.fillStyle='#142a1c';
          ctx.fillRect(sx,sy,TILE,TILE);
          ctx.globalAlpha=brightness;
          ctx.shadowBlur=10; ctx.shadowColor='#39ff14';
          ctx.fillStyle='#39ff14';
          ctx.font='16px monospace';
          ctx.fillText('◈',sx+4,sy+20);
          break;
        case T.IMPLANT_SHRINE: {
          ctx.fillStyle='#1c1430';
          ctx.fillRect(sx,sy,TILE,TILE);
          ctx.globalAlpha=brightness;
          const impPulse = 0.6 + 0.4 * Math.sin(lastTime / 700 + tx * 0.9 + ty * 0.6);
          ctx.shadowBlur=12; ctx.shadowColor='#cc44ff';
          ctx.fillStyle=`rgba(204,68,255,${impPulse})`;
          ctx.font='18px monospace';
          ctx.fillText('◆',sx+5,sy+20);
          break;
        }
        case T.EVENT_TERMINAL: {
          ctx.fillStyle='#142a2a';
          ctx.fillRect(sx,sy,TILE,TILE);
          ctx.globalAlpha=brightness;
          const evPulse = 0.5 + 0.5 * Math.sin(lastTime / 500 + tx * 1.3 + ty * 0.8);
          ctx.shadowBlur=14; ctx.shadowColor='#44ffcc';
          ctx.fillStyle=`rgba(68,255,204,${evPulse})`;
          ctx.font='18px monospace';
          ctx.fillText('◈',sx+5,sy+20);
          break;
        }
        case T.TELEPORT_PAD: {
          ctx.fillStyle='#1c1430';
          ctx.fillRect(sx,sy,TILE,TILE);
          ctx.globalAlpha=brightness;
          const tpPulse = 0.5 + 0.5 * Math.sin(lastTime / 400 + tx * 1.5 + ty * 1.1);
          ctx.shadowBlur=14; ctx.shadowColor='#bb44ff';
          ctx.fillStyle=`rgba(187,68,255,${tpPulse})`;
          ctx.font='18px monospace';
          ctx.fillText('⬡',sx+4,sy+20);
          break;
        }
        case T.LORE: {
          ctx.fillStyle='#2a2010';
          ctx.fillRect(sx,sy,TILE,TILE);
          ctx.globalAlpha=brightness;
          const lorePulse = 0.7 + 0.3 * Math.sin(lastTime / 600 + tx * 1.1 + ty * 0.7);
          ctx.shadowBlur=8; ctx.shadowColor='#ffb700';
          ctx.fillStyle=`rgba(255,183,0,${lorePulse})`;
          ctx.font='16px monospace';
          ctx.fillText('◫',sx+4,sy+20);
          break;
        }
        case T.DOOR:
          ctx.fillStyle='#252545'; ctx.fillRect(sx,sy,TILE,TILE);
          ctx.fillStyle='#664422'; ctx.fillRect(sx+2,sy+1,TILE-4,TILE-2);
          ctx.fillStyle='#886633'; ctx.fillRect(sx+3,sy+2,TILE-6,TILE-4);
          ctx.fillStyle='#aa8844'; ctx.fillRect(sx+TILE-7,sy+TILE/2-2,3,3); // handle
          break;
        case T.DOOR_OPEN:
          ctx.fillStyle='#252545'; ctx.fillRect(sx,sy,TILE,TILE);
          ctx.fillStyle='#33261a'; ctx.fillRect(sx,sy,3,TILE);
          ctx.fillStyle='#33261a'; ctx.fillRect(sx+TILE-3,sy,3,TILE);
          break;
        case T.LOCKED_R: case T.LOCKED_B: case T.LOCKED_G: {
          const lc=tile===T.LOCKED_R?'#ff3333':tile===T.LOCKED_B?'#3388ff':'#ffcc00';
          ctx.fillStyle='#252545'; ctx.fillRect(sx,sy,TILE,TILE);
          ctx.fillStyle='#443322'; ctx.fillRect(sx+2,sy+1,TILE-4,TILE-2);
          ctx.shadowBlur=8; ctx.shadowColor=lc;
          ctx.fillStyle=lc; ctx.fillRect(sx+TILE/2-3,sy+TILE/2-3,6,6); // lock glow
          break;
        }
        case T.TRAP_SPIKE:
          ctx.fillStyle='#252545'; ctx.fillRect(sx,sy,TILE,TILE);
          ctx.globalAlpha=brightness*0.35;
          ctx.fillStyle='#ff6644';
          for (let s=0;s<3;s++) ctx.fillRect(sx+3+s*6,sy+TILE-6,2,5); // subtle spikes
          break;
        case T.TRAP_SLOW:
          ctx.fillStyle='#252545'; ctx.fillRect(sx,sy,TILE,TILE);
          ctx.globalAlpha=brightness*0.25;
          ctx.fillStyle='#8866ff';
          ctx.fillRect(sx+3,sy+3,TILE-6,TILE-6); // subtle goo
          break;
        case T.PLASMA: {
          ctx.fillStyle='#252545'; ctx.fillRect(sx,sy,TILE,TILE);
          // Animated orange glow with pulsing brightness
          const pPulse = 0.3 + 0.15 * Math.sin(lastTime / 400 + tx * 0.7 + ty * 1.3);
          ctx.globalAlpha = brightness * pPulse;
          ctx.fillStyle='#ff4400';
          ctx.fillRect(sx+1,sy+1,TILE-2,TILE-2);
          // Bright core
          ctx.globalAlpha = brightness * pPulse * 0.6;
          ctx.fillStyle='#ff8800';
          ctx.fillRect(sx+3,sy+3,TILE-6,TILE-6);
          // Shimmer bubbles
          ctx.shadowBlur=4; ctx.shadowColor='#ff6600';
          const bx = sx + 4 + Math.sin(lastTime/300 + tx*2) * 3;
          const by = sy + 4 + Math.cos(lastTime/350 + ty*2) * 3;
          ctx.fillStyle='#ffaa33';
          ctx.globalAlpha = brightness * 0.4;
          ctx.fillRect(bx, by, 2, 2);
          break;
        }
        case T.ARC: {
          ctx.fillStyle='#252545'; ctx.fillRect(sx,sy,TILE,TILE);
          // Phase-based rendering: bright when active, dim when off
          const arcActive = Math.sin((game.floorTime||0) * Math.PI) > 0;
          const aAlpha = arcActive ? 0.5 + 0.2 * Math.sin(lastTime/80) : 0.1;
          ctx.globalAlpha = brightness * aAlpha;
          ctx.fillStyle = arcActive ? '#44ccff' : '#1a3344';
          ctx.fillRect(sx+2,sy+2,TILE-4,TILE-4);
          if (arcActive) {
            // Crackling arc lines
            ctx.shadowBlur=6; ctx.shadowColor='#00ccff';
            ctx.strokeStyle='#88eeff';
            ctx.lineWidth=1;
            ctx.globalAlpha = brightness * 0.7;
            ctx.beginPath();
            const mid = TILE/2;
            ctx.moveTo(sx+2, sy+mid + Math.sin(lastTime/50)*3);
            ctx.lineTo(sx+mid, sy+mid + Math.cos(lastTime/60)*4);
            ctx.lineTo(sx+TILE-2, sy+mid + Math.sin(lastTime/70+1)*3);
            ctx.stroke();
            // Vertical arc
            ctx.beginPath();
            ctx.moveTo(sx+mid + Math.cos(lastTime/55)*3, sy+2);
            ctx.lineTo(sx+mid + Math.sin(lastTime/65)*4, sy+mid);
            ctx.lineTo(sx+mid + Math.cos(lastTime/75+1)*3, sy+TILE-2);
            ctx.stroke();
          }
          break;
        }
        case T.TOXIC: {
          ctx.fillStyle='#252545'; ctx.fillRect(sx,sy,TILE,TILE);
          // Pulsing green/chartreuse corrosive pool
          const tPulse = 0.25 + 0.12 * Math.sin(lastTime / 500 + tx * 0.9 + ty * 1.1);
          ctx.globalAlpha = brightness * tPulse;
          ctx.fillStyle='#22aa00';
          ctx.fillRect(sx+1,sy+1,TILE-2,TILE-2);
          // Bright core
          ctx.globalAlpha = brightness * tPulse * 0.7;
          ctx.fillStyle='#44ff22';
          ctx.fillRect(sx+3,sy+3,TILE-6,TILE-6);
          // Bubbling particles
          ctx.shadowBlur=4; ctx.shadowColor='#33ff00';
          ctx.fillStyle='#88ff44';
          ctx.globalAlpha = brightness * 0.5;
          const tb1x = sx + 5 + Math.sin(lastTime/350 + tx*1.7) * 3;
          const tb1y = sy + 5 + Math.cos(lastTime/400 + ty*1.5) * 3;
          ctx.fillRect(tb1x, tb1y, 2, 2);
          const tb2x = sx + TILE - 7 + Math.cos(lastTime/300 + tx*2.1) * 2;
          const tb2y = sy + TILE - 7 + Math.sin(lastTime/380 + ty*1.9) * 2;
          ctx.fillRect(tb2x, tb2y, 2, 2);
          break;
        }
        case T.CRATE: {
          // Dark metallic crate with cyan neon outlines
          ctx.fillStyle = '#141422';
          ctx.fillRect(sx, sy, TILE, TILE);
          // Outer edge
          ctx.fillStyle = '#1e1e38';
          ctx.fillRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
          // Inner panel
          ctx.fillStyle = '#12121f';
          ctx.fillRect(sx + 3, sy + 3, TILE - 6, TILE - 6);
          // Neon cyan outlines
          ctx.globalAlpha = brightness * 0.7;
          ctx.shadowBlur = 4; ctx.shadowColor = '#44ccff';
          ctx.strokeStyle = '#44ccff';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 1.5, sy + 1.5, TILE - 3, TILE - 3);
          // Circuit-line detail (cross)
          ctx.globalAlpha = brightness * 0.4;
          ctx.beginPath();
          ctx.moveTo(sx + TILE / 2, sy + 4);
          ctx.lineTo(sx + TILE / 2, sy + TILE - 4);
          ctx.moveTo(sx + 4, sy + TILE / 2);
          ctx.lineTo(sx + TILE - 4, sy + TILE / 2);
          ctx.stroke();
          // Centre glow dot
          ctx.globalAlpha = brightness * 0.5;
          ctx.fillStyle = '#44ccff';
          ctx.fillRect(sx + TILE / 2 - 1, sy + TILE / 2 - 1, 2, 2);
          break;
        }
        case T.CRACKED: {
          // Render as wall base
          ctx.fillStyle='#1a1a2e';
          ctx.fillRect(sx,sy,TILE,TILE);
          ctx.fillStyle='#2d2d5e';
          ctx.fillRect(sx,sy,TILE,2);
          ctx.fillRect(sx,sy,2,TILE);
          // Show crack lines only when player is within 3 tiles
          const pdx=tx-Math.floor(game.player.x), pdy=ty-Math.floor(game.player.y);
          const pDist=Math.sqrt(pdx*pdx+pdy*pdy);
          if (pDist <= 3) {
            const crackAlpha = brightness * Math.max(0.15, 0.5 * (1 - pDist/3));
            ctx.globalAlpha = crackAlpha;
            ctx.strokeStyle='#ffb700';
            ctx.shadowBlur=4; ctx.shadowColor='#ffb700';
            ctx.lineWidth=1;
            ctx.beginPath();
            const seed = tx * 137 + ty * 311;
            const mx = sx + TILE/2 + (seed%5-2);
            const my = sy + TILE/2 + (seed%7-3);
            ctx.moveTo(sx+2, my-2);
            ctx.lineTo(mx-1, my+1);
            ctx.lineTo(sx+TILE-3, my+2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(mx+1, sy+3);
            ctx.lineTo(mx-2, my);
            ctx.lineTo(mx+2, sy+TILE-3);
            ctx.stroke();
          }
          break;
        }
        case T.CHALLENGE_GATE: {
          ctx.fillStyle='#1a0a0a';
          ctx.fillRect(sx,sy,TILE,TILE);
          const gatePulse = 0.5 + 0.3 * Math.sin(lastTime / 500 + tx * 0.9 + ty * 1.1);
          ctx.globalAlpha = brightness * gatePulse;
          ctx.shadowBlur=10; ctx.shadowColor='#ff6633';
          ctx.fillStyle='#ff6633';
          ctx.fillRect(sx, sy, 3, TILE);
          ctx.fillRect(sx+TILE-3, sy, 3, TILE);
          ctx.fillRect(sx, sy, TILE, 3);
          ctx.globalAlpha = brightness * gatePulse * 0.4;
          ctx.fillStyle='#ff9933';
          ctx.fillRect(sx+3, sy+3, TILE-6, TILE-6);
          break;
        }
      }
      ctx.restore();
    }
  }
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
function drawHUD(player) {
  const y = layout.hudTop;
  const lx = 14 + safeLeft;   // left anchor respecting safe area
  ctx.save();
  ctx.fillStyle='rgba(10,10,18,0.85)';
  ctx.fillRect(0, y - 2, W, H - y + 2);

  if (layout.compact) {
    // ── Compact portrait: two rows ──
    const fs = 10;
    const r1 = y + 4;   // row 1 baseline offset
    const r2 = y + 28;  // row 2 baseline offset
    const hpW = Math.min(100, W * 0.25);

    // Row 1: HP bar + FLR + score
    ctx.fillStyle='#1a1a2e'; ctx.fillRect(lx, r1, hpW, 12);
    const hpFrac = player.hp / player.maxHp;
    const hpCol = hpFrac > 0.5 ? '#00f5ff' : hpFrac > 0.25 ? '#ffb700' : '#ff3333';
    ctx.shadowBlur=6; ctx.shadowColor=hpCol;
    ctx.fillStyle=hpCol; ctx.fillRect(lx, r1, hpW * hpFrac, 12);
    ctx.shadowBlur=0;
    ctx.fillStyle='#e0e0ff'; ctx.font=`${fs}px monospace`;
    ctx.fillText(`HP ${Math.ceil(player.hp)}/${player.maxHp}`, lx + 2, r1 + 10);

    const mid = lx + hpW + 10;
    ctx.fillStyle='#e0e0ff'; ctx.font=`${fs}px monospace`;
    ctx.fillText(`FLR:${game.floor}`, mid, r1 + 10);

    // Floor modifier badge
    if (game.modifier) {
      const m = getMod();
      ctx.save();
      ctx.shadowBlur=4; ctx.shadowColor=m.colour;
      ctx.fillStyle=m.colour; ctx.font=`${fs-1}px monospace`;
      ctx.fillText(`${m.icon}${m.label}`, mid, r1 + 22);
      ctx.restore();
    }

    ctx.shadowBlur=4; ctx.shadowColor='#ffb700';
    ctx.fillStyle='#ffb700'; ctx.font=`${fs + 1}px monospace`;
    ctx.textAlign='right';
    ctx.fillText(`SCORE:${player.score}`, W - 10 - safeRight, r1 + 10);
    // Combo counter (compact)
    if (combo.count >= 2) {
      const cc = comboColour();
      const a = combo.flashTimer > 0 ? 1 : 0.6 + 0.4 * (combo.timer / COMBO_WINDOW);
      ctx.globalAlpha = a;
      ctx.shadowBlur=6; ctx.shadowColor=cc;
      ctx.fillStyle=cc; ctx.font=`bold ${fs + 1}px monospace`;
      ctx.fillText(`×${comboMultiplier().toFixed(1)} ×${combo.count}`, W - 10 - safeRight, r1 + 22);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign='left'; ctx.shadowBlur=0;

    // Credits + Lore
    ctx.fillStyle='#39ff14'; ctx.font=`${fs}px monospace`;
    ctx.fillText(`◈${player.credits}`, mid + 50, r1 + 10);
    if (player.loreRead.size > 0) {
      ctx.fillStyle='#ffb700';
      ctx.fillText(`◫${player.loreRead.size}`, mid + 90, r1 + 10);
    }

    // Row 2: LVL + XP bar + ATK + DEF + weapon
    ctx.fillStyle='#aaaacc'; ctx.font=`${fs}px monospace`;
    ctx.fillText(`LV:${player.level}`, lx, r2 + 10);
    const xpBarX = lx + 34;
    const xpFrac = player.xp / player.xpNeeded();
    ctx.fillStyle='#333'; ctx.fillRect(xpBarX, r2 + 3, 36, 4);
    ctx.fillStyle='#ffb700'; ctx.fillRect(xpBarX, r2 + 3, 36 * xpFrac, 4);

    const statsX = xpBarX + 44;
    ctx.fillStyle='#e0e0ff'; ctx.font=`${fs}px monospace`;
    ctx.fillText(`A:${player.atk}`, statsX, r2 + 10);
    ctx.fillText(`D:${player.def}`, statsX + 36, r2 + 10);

    // Weapon — truncate if needed, use rarity colour for affixed weapons
    const wRarity = player.weapon._rarity || 0;
    const wColour = wRarity > 0 ? RARITY_COLOURS[wRarity] : '#ff00c8';
    ctx.shadowBlur=6; ctx.shadowColor=wColour;
    ctx.fillStyle=wColour; ctx.font=`${fs}px monospace`;
    const weapMaxW = W - (statsX + 80) - safeRight - 10;
    let weapName = player.weapon.displayName || player.weapon.name;
    if (ctx.measureText(weapName).width > weapMaxW && weapMaxW > 20) {
      while (weapName.length > 3 && ctx.measureText(weapName + '…').width > weapMaxW) weapName = weapName.slice(0, -1);
      weapName += '…';
    }
    ctx.fillText(weapName, statsX + 74, r2 + 10);
    ctx.shadowBlur=0;

    if (player.shards > 0) {
      ctx.fillStyle='#aa00ff'; ctx.font=`${fs}px monospace`;
      ctx.fillText(`V×${player.shards}`, statsX + 74, r2 + 22);
    }
    // Hackware indicator (compact)
    if (player.hackware) {
      const hw = HACKWARE[player.hackware];
      ctx.fillStyle=player.hackwareCooldown>0?'#665533':hw.colour; ctx.font=`${fs}px monospace`;
      const hwX = player.shards > 0 ? statsX + 120 : statsX + 74;
      ctx.fillText(`F:${hw.icon}`, hwX, r2 + 22);
    }
    // Energy shield recharge indicator
    if (player.perks.ENERGY_SHIELD && !player.energyShield) {
      ctx.fillStyle='#4488ff'; ctx.font=`${fs}px monospace`;
      ctx.fillText(`🛡${Math.ceil(player.energyShieldTimer)}s`, lx, r2 + 22);
    }
    // Dash cooldown (compact)
    if (player.dashCooldown > 0) {
      ctx.fillStyle='#ffb700'; ctx.font=`${fs}px monospace`;
      ctx.fillText(`⇧${player.dashCooldown.toFixed(1)}s`, lx + 50, r2 + 22);
    }
  } else {
    // ── Standard landscape HUD: single row ──
    ctx.fillStyle='#1a1a2e'; ctx.fillRect(lx, y + 4, 130, 14);
    const hpFrac = player.hp / player.maxHp;
    const hpCol = hpFrac > 0.5 ? '#00f5ff' : hpFrac > 0.25 ? '#ffb700' : '#ff3333';
    ctx.shadowBlur=6; ctx.shadowColor=hpCol;
    ctx.fillStyle=hpCol; ctx.fillRect(lx, y + 4, 130 * hpFrac, 14);
    ctx.shadowBlur=0;

    ctx.fillStyle='#e0e0ff'; ctx.font='13px monospace';
    ctx.fillText(`HP ${Math.ceil(player.hp)}/${player.maxHp}`, lx + 4, y + 15);

    const colBase = lx + 141;
    ctx.fillStyle='#aaaacc'; ctx.font='13px monospace';
    ctx.fillText(`LVL:${player.level}`, colBase, y + 10);
    const xpFrac = player.xp / player.xpNeeded();
    ctx.fillStyle='#333'; ctx.fillRect(colBase, y + 12, 50, 4);
    ctx.fillStyle='#ffb700'; ctx.fillRect(colBase, y + 12, 50 * xpFrac, 4);

    ctx.fillStyle='#e0e0ff';
    ctx.fillText(`ATK:${player.atk}`, colBase + 60, y + 10);
    ctx.fillText(`DEF:${player.def}`, colBase + 105, y + 10);
    ctx.fillText(`FLR:${game.floor}`, colBase + 160, y + 10);

    // Floor modifier badge
    if (game.modifier) {
      const m = getMod();
      ctx.save();
      ctx.shadowBlur=4; ctx.shadowColor=m.colour;
      ctx.fillStyle=m.colour;
      ctx.fillText(`${m.icon}${m.label}`, colBase + 160, y + 22);
      ctx.restore();
    }

    const wRarL = player.weapon._rarity || 0;
    const wColL = wRarL > 0 ? RARITY_COLOURS[wRarL] : '#ff00c8';
    ctx.shadowBlur=6; ctx.shadowColor=wColL;
    ctx.fillStyle=wColL;
    let wNameL = player.weapon.displayName || player.weapon.name;
    const wMaxL = W - (colBase + 230) - 10;
    if (ctx.measureText(wNameL).width > wMaxL && wMaxL > 20) {
      while (wNameL.length > 3 && ctx.measureText(wNameL + '…').width > wMaxL) wNameL = wNameL.slice(0, -1);
      wNameL += '…';
    }
    ctx.fillText(wNameL, colBase + 220, y + 10);
    ctx.shadowBlur=0;

    if (player.shards > 0) {
      ctx.fillStyle='#aa00ff'; ctx.fillText(`[V] Void Shard ×${player.shards}`, colBase + 220, y + 22);
    }
    // Hackware indicator (landscape)
    if (player.hackware) {
      const hw = HACKWARE[player.hackware];
      const hwCol = player.hackwareCooldown > 0 ? '#665533' : hw.colour;
      ctx.fillStyle=hwCol;
      const hwLabel = player.hackwareCooldown > 0
        ? `[F] ${hw.icon}${hw.name} ${player.hackwareCooldown.toFixed(1)}s`
        : `[F] ${hw.icon}${hw.name} RDY`;
      const hwX = player.shards > 0 ? colBase + 380 : colBase + 220;
      ctx.fillText(hwLabel, hwX, y + 22);
    }
    // Energy shield recharge indicator
    if (player.perks.ENERGY_SHIELD && !player.energyShield) {
      ctx.fillStyle='#4488ff'; ctx.fillText(`🛡 ${Math.ceil(player.energyShieldTimer)}s`, colBase, y + 22);
    }
    // Dash cooldown (landscape)
    if (player.dashCooldown > 0) {
      ctx.fillStyle='#ffb700'; ctx.fillText(`[⇧] DASH ${player.dashCooldown.toFixed(1)}s`, colBase + 60, y + 22);
    }

    ctx.shadowBlur=4; ctx.shadowColor='#ffb700';
    ctx.fillStyle='#ffb700';
    ctx.font='14px monospace';
    ctx.fillText(`SCORE: ${player.score}`, W - 160 - safeRight, y + 12);
    ctx.shadowBlur=0;
    // Combo counter (landscape)
    if (combo.count >= 2) {
      const cc = comboColour();
      const a = combo.flashTimer > 0 ? 1 : 0.6 + 0.4 * (combo.timer / COMBO_WINDOW);
      ctx.globalAlpha = a;
      ctx.shadowBlur=6; ctx.shadowColor=cc;
      ctx.fillStyle=cc; ctx.font='bold 15px monospace';
      ctx.textAlign='right';
      ctx.fillText(`×${comboMultiplier().toFixed(1)} COMBO ×${combo.count}`, W - 10 - safeRight, y + 12);
      ctx.textAlign='left'; ctx.globalAlpha = 1;
    }
    ctx.shadowBlur=0;
    ctx.fillStyle='#39ff14'; ctx.font='13px monospace';
    ctx.fillText(`◈ ${player.credits}`, W - 160 - safeRight, y + 26);
    if (player.loreRead.size > 0) {
      ctx.fillStyle='#ffb700'; ctx.font='13px monospace';
      ctx.fillText(`◫ ${player.loreRead.size}`, W - 100 - safeRight, y + 26);
    }
  }
  ctx.restore();

  // Key indicators (above HUD bar)
  const hasKeys = player.keys.red + player.keys.blue + player.keys.gold > 0;
  if (hasKeys) {
    ctx.save();
    const keyY = layout.hudTop - 18;
    let kx = 14 + safeLeft;
    const keyData = [['red','#ff3333'],['blue','#3388ff'],['gold','#ffcc00']];
    for (const [col, hex] of keyData) {
      if (player.keys[col] > 0) {
        ctx.shadowBlur=6; ctx.shadowColor=hex;
        ctx.fillStyle=hex; ctx.font='bold 12px monospace';
        ctx.fillText('🔑×'+player.keys[col], kx, keyY);
        kx += 55;
      }
    }
    ctx.restore();
  }
  if (player.levelFlash>0) {
    ctx.save();
    ctx.globalAlpha=Math.min(0.5,player.levelFlash*0.35);
    ctx.fillStyle='#00f5ff';
    ctx.fillRect(0,0,W,H);
    ctx.restore();
    if (player.levelFlash>0.5) {
      ctx.save();
      ctx.shadowBlur=20; ctx.shadowColor='#00f5ff';
      ctx.fillStyle='#00f5ff'; ctx.font='bold 36px monospace';
      ctx.textAlign='center'; ctx.fillText('LEVEL UP!',W/2,H/2-40);
      ctx.textAlign='left'; ctx.restore();
    }
  }
}

// ─── Boss HUD Bar ─────────────────────────────────────────────────────────────
function drawBossBar() {
  if (!game.bossAlive && game.bossBarAnim <= 0) return;
  const boss = enemies.find(e => e.isBoss && !e.dead);
  if (!boss && game.bossBarAnim <= 0) return;

  const anim = game.bossBarAnim;
  const slideY = -30 * (1 - easeOutCubic(anim));
  const alpha = anim;

  // Constrain width to avoid minimap overlap (minimap at W-128-safeRight)
  const minimapLeft = W - 128 - safeRight - 12; // 12px margin
  const maxBarW = Math.max(100, (minimapLeft - safeLeft) * 0.8);
  const barW = Math.min(320, maxBarW);
  const barH = 8;
  const barX = Math.min((W - barW) / 2, minimapLeft - barW);
  const barY = 16 + safeTop + slideY;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Boss name
  const name = BOSS_NAMES[game.bossType] || game.bossType || 'BOSS';
  const barCx = barX + barW / 2;
  ctx.textAlign = 'center';
  ctx.font = 'bold 10px monospace';
  const col = boss ? boss.colour : '#ff3333';
  ctx.shadowBlur = 8; ctx.shadowColor = col;
  ctx.fillStyle = col;
  ctx.fillText(name, barCx, barY - 3);

  if (!boss) { ctx.restore(); return; }

  // Bar frame
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#2d2d5e'; ctx.lineWidth = 1;
  ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);

  // Bar background
  ctx.fillStyle = '#111122';
  ctx.fillRect(barX, barY, barW, barH);

  // Ghost HP (trailing damage indicator)
  const ghostFrac = Math.max(0, Math.min(1, game.bossHpGhost / boss.maxHp));
  if (ghostFrac > 0) {
    ctx.fillStyle = 'rgba(255,100,100,0.25)';
    ctx.fillRect(barX, barY, barW * ghostFrac, barH);
  }

  // Actual HP bar with subtle gradient
  const hpFrac = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
  if (hpFrac > 0) {
    ctx.shadowBlur = 4; ctx.shadowColor = col;
    ctx.fillStyle = col;
    ctx.fillRect(barX, barY, barW * hpFrac, barH);
    // Bright highlight on top edge
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(barX, barY, barW * hpFrac, 2);
  }
  ctx.shadowBlur = 0;

  // Phase threshold notch marks
  const marks = getBossPhaseMarks(boss);
  for (const m of marks) {
    if (m > 0 && m < 1) {
      const nx = barX + barW * m;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(nx - 0.5, barY - 2, 1, barH + 4);
    }
  }

  // HP text + phase label
  ctx.font = '8px monospace';
  ctx.fillStyle = '#8888aa';
  ctx.textAlign = 'center';
  const hpText = `${Math.ceil(boss.hp)}/${boss.maxHp}`;
  const phaseText = boss.phase > 1 ? `  P${boss.phase}` : '';
  ctx.fillText(hpText + phaseText, barCx, barY + barH + 9);

  ctx.restore();
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// ─── Minimap ──────────────────────────────────────────────────────────────────
function drawMinimap(dungeon, player) {
  const MW=120, MH=80, MX=W-MW-8-safeRight, MY=8+safeTop;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.75)';
  ctx.fillRect(MX-2,MY-2,MW+4,MH+4);
  ctx.strokeStyle='#2d2d5e'; ctx.lineWidth=1; ctx.strokeRect(MX-2,MY-2,MW+4,MH+4);

  const sx=MW/MAP_W, sy=MH/MAP_H;
  const pois = [];
  const echoMap = game.mapRevealed; // ECHO_MAPPER: show layout even if unvisited
  for (let ty=0;ty<MAP_H;ty++) {
    for (let tx=0;tx<MAP_W;tx++) {
      const visited = dungeon.visited[ty][tx];
      if (!visited && !echoMap) continue;
      const tile=dungeon.map[ty][tx];
      const px2=MX+tx*sx, py2=MY+ty*sy;
      let col=null;
      if (!visited && echoMap) {
        // Echo mapper: dimmed layout, no POIs, no details, skip secret rooms
        if (dungeon.secretMask && dungeon.secretMask[ty][tx]) continue;
        if (tile===T.WALL||tile===T.CRACKED||tile===T.CRATE) col='#0d0d1a';
        else if (isPassable(tile)||tile===T.DOOR) col='#141428';
        if (col) { ctx.fillStyle=col; ctx.fillRect(px2,py2,Math.max(1,sx),Math.max(1,sy)); }
        continue;
      }
      if (tile===T.WALL||tile===T.CRACKED) {
        col = (game.bossSealed && game.bossEntrances.some(e=>e.x===tx&&e.y===ty)) ||
              (game.challengeSealed && game.challengeEntrances.some(e=>e.x===tx&&e.y===ty)) ? '#5e2d2d' : '#1a1a2e';
      }
      else if (tile===T.FLOOR||tile===T.DOOR_OPEN||tile===T.TRAP_SPIKE||tile===T.TRAP_SLOW||tile===T.IMPLANT_SHRINE||tile===T.EVENT_TERMINAL||tile===T.TELEPORT_PAD) col='#202040';
      else if (tile===T.PLASMA) col='#ff6600';
      else if (tile===T.ARC) col= Math.sin((game.floorTime||0)*Math.PI)>0 ? '#44ccff' : '#1a3344';
      else if (tile===T.TOXIC) col='#33ff00';
      else if (tile===T.STAIRS||tile===T.TERMINAL) col='#ffff00';
      else if (tile===T.VENDOR) col='#39ff14';
      else if (tile===T.LORE) col='#ffb700';
      else if (tile===T.DOOR) col='#664422';
      else if (tile===T.LOCKED_R) col='#ff3333';
      else if (tile===T.LOCKED_B) col='#3388ff';
      else if (tile===T.LOCKED_G) col='#ffcc00';
      else if (tile===T.CHALLENGE_GATE) col='#ff6633';
      else if (tile===T.CRATE) col='#2a3a4e';
      if (col) { ctx.fillStyle=col; ctx.fillRect(px2,py2,Math.max(1,sx),Math.max(1,sy)); }
      // Collect POI tiles for marker overlay
      if (tile===T.STAIRS||tile===T.TERMINAL||tile===T.VENDOR||tile===T.LORE||tile===T.CHALLENGE_GATE||tile===T.IMPLANT_SHRINE||tile===T.EVENT_TERMINAL||tile===T.TELEPORT_PAD) {
        pois.push({tile, px:px2+sx/2, py:py2+sy/2});
      }
    }
  }

  // enemies — only in current LOS, or everywhere with THERMAL_OPTICS
  const thermalOptics = hasAugment('THERMAL_OPTICS');
  for (const e of enemies) {
    if (e.dead) continue;
    if (e._disguised) continue; // disguised mimics hidden from minimap
    const tx = Math.floor(e.x), ty = Math.floor(e.y);
    const inSight = !!dungeon.visible[ty]?.[tx];
    // Cloaked PHANTOMs: only show via Thermal Optics (dim purple)
    if (e.type === 'PHANTOM' && !e.visible) {
      if (!thermalOptics) continue;
      const phPulse = 0.3 + 0.2 * Math.sin((game.floorTime||0) * 4);
      ctx.globalAlpha = phPulse;
      ctx.fillStyle = '#cc00ff';
      ctx.fillRect(MX+e.x*sx-1,MY+e.y*sy-1,2,2);
      ctx.globalAlpha = 1;
      continue;
    }
    // Phased WRAITHs: only show via Thermal Optics (dim spectral cyan-green)
    if (e._wrPhased) {
      if (!thermalOptics) continue;
      const wrPulse = 0.2 + 0.15 * Math.sin((game.floorTime||0) * 5);
      ctx.globalAlpha = wrPulse;
      ctx.fillStyle = '#66ffcc';
      ctx.fillRect(MX+e.x*sx-1,MY+e.y*sy-1,2,2);
      ctx.globalAlpha = 1;
      continue;
    }
    if (!thermalOptics && !inSight) continue;
    if (e._isBounty) {
      const bPulse = 0.7 + 0.3 * Math.sin((game.floorTime||0) * 3);
      ctx.globalAlpha=bPulse;
      ctx.shadowBlur=4; ctx.shadowColor='#ffd700';
      ctx.fillStyle='#ffd700';
      ctx.fillRect(MX+e.x*sx-2,MY+e.y*sy-2,4,4);
      ctx.globalAlpha=1; ctx.shadowBlur=0;
    } else if (e.elite && e.eliteAffix) {
      ctx.fillStyle=ELITE_AFFIXES[e.eliteAffix].colour;
      ctx.fillRect(MX+e.x*sx-1.5,MY+e.y*sy-1.5,3,3);
    } else {
      ctx.fillStyle= thermalOptics && !inSight ? '#ff666688' : '#ff3333';
      ctx.fillRect(MX+e.x*sx-1,MY+e.y*sy-1,2,2);
    }
  }

  // POI markers — larger glowing indicators for key locations
  const pulse = 0.65 + 0.35 * Math.sin((game.floorTime||0) * 2.5);
  for (const p of pois) {
    let col, sz;
    if (p.tile===T.STAIRS||p.tile===T.TERMINAL) { col='#ffffff'; sz=3; }
    else if (p.tile===T.VENDOR) { col='#39ff14'; sz=3; }
    else if (p.tile===T.CHALLENGE_GATE) { col='#ff6633'; sz=3; }
    else if (p.tile===T.IMPLANT_SHRINE) { col='#cc44ff'; sz=3; }
    else if (p.tile===T.EVENT_TERMINAL) { col='#44ffcc'; sz=3; }
    else if (p.tile===T.TELEPORT_PAD) { col='#bb44ff'; sz=3; }
    else { col='#ffb700'; sz=2; } // LORE
    ctx.globalAlpha=pulse;
    ctx.shadowBlur=5; ctx.shadowColor=col;
    ctx.fillStyle=col;
    ctx.fillRect(p.px-sz/2, p.py-sz/2, sz, sz);
  }
  // Boss entrance markers when sealed
  if (game.bossSealed && game.bossEntrances) {
    const bPulse = 0.5 + 0.5 * Math.sin((game.floorTime||0) * 4);
    ctx.globalAlpha=bPulse;
    ctx.shadowBlur=6; ctx.shadowColor='#ff3333';
    ctx.fillStyle='#ff3333';
    for (const be of game.bossEntrances) {
      if (!dungeon.visited[be.y]?.[be.x]) continue;
      ctx.fillRect(MX+be.x*sx+sx/2-2, MY+be.y*sy+sy/2-2, 4, 4);
    }
  }
  // Challenge entrance markers when sealed
  if (game.challengeSealed && game.challengeEntrances) {
    const cPulse = 0.5 + 0.5 * Math.sin((game.floorTime||0) * 3.5);
    ctx.globalAlpha=cPulse;
    ctx.shadowBlur=6; ctx.shadowColor='#ff6633';
    ctx.fillStyle='#ff6633';
    for (const ce of game.challengeEntrances) {
      if (!dungeon.visited[ce.y]?.[ce.x]) continue;
      ctx.fillRect(MX+ce.x*sx+sx/2-2, MY+ce.y*sy+sy/2-2, 4, 4);
    }
  }
  // Volatile cores — small orange dots
  for (const c of vcores) {
    if (c.dead) continue;
    const tx = Math.floor(c.x), ty = Math.floor(c.y);
    if (!dungeon.visible[ty]?.[tx]) continue;
    ctx.fillStyle = c.primed ? '#ff2200' : '#ff6622';
    ctx.fillRect(MX+c.x*sx-0.5, MY+c.y*sy-0.5, 1.5, 1.5);
  }
  // Alarm beacons — pulsing red dots
  for (const b of beacons) {
    if (b.dead) continue;
    const tx = Math.floor(b.x), ty = Math.floor(b.y);
    if (!dungeon.visible[ty]?.[tx]) continue;
    const bp = b.active ? (0.5 + 0.5 * Math.sin((game.floorTime||0) * 6)) : (0.6 + 0.3 * Math.sin((game.floorTime||0) * 2));
    ctx.globalAlpha = bp;
    ctx.shadowBlur = 4; ctx.shadowColor = '#ff2222';
    ctx.fillStyle = b.active ? '#ff0000' : '#ff3333';
    ctx.fillRect(MX+b.x*sx-1, MY+b.y*sy-1, 2, 2);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  // Proximity mines — orange dots (only when revealed or armed)
  for (const m of mines) {
    if (m.dead) continue;
    if (!m.revealed && m.state !== 'armed') continue;
    const tx = Math.floor(m.x), ty = Math.floor(m.y);
    if (!dungeon.visible[ty]?.[tx]) continue;
    if (m.state === 'armed') {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin((game.floorTime||0) * 12);
      ctx.fillStyle = '#ff4400';
    } else {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ff8800';
    }
    ctx.fillRect(MX+m.x*sx-0.5, MY+m.y*sy-0.5, 1.5, 1.5);
    ctx.globalAlpha = 1;
  }
  // Shield generators — cyan dots
  for (const g of shieldGens) {
    if (g.dead) continue;
    const tx = Math.floor(g.x), ty = Math.floor(g.y);
    if (!dungeon.visible[ty]?.[tx]) continue;
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin((game.floorTime||0) * 2);
    ctx.shadowBlur = 4; ctx.shadowColor = '#00ccff';
    ctx.fillStyle = '#00ccff';
    ctx.fillRect(MX+g.x*sx-1, MY+g.y*sy-1, 2, 2);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  // Security cameras — small red triangles
  for (const cam of cameras) {
    if (cam.dead) continue;
    const tx = Math.floor(cam.x), ty = Math.floor(cam.y);
    if (!dungeon.visible[ty]?.[tx]) continue;
    const pulse = cam.state === 'alerted' ? 0.9 : 0.5 + 0.3 * Math.sin((game.floorTime||0) * 2);
    ctx.globalAlpha = pulse;
    ctx.shadowBlur = 3; ctx.shadowColor = '#ff3300';
    ctx.fillStyle = cam.state === 'alerted' ? '#ff4422' : '#ff3300';
    const px = MX + cam.x * sx, py = MY + cam.y * sy;
    ctx.beginPath();
    ctx.moveTo(px, py - 1.5);
    ctx.lineTo(px - 1.5, py + 1.5);
    ctx.lineTo(px + 1.5, py + 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  // Laser tripwires — thin orange/red lines
  for (const l of lasers) {
    if (l.dead) continue;
    const t1x = Math.floor(l.x1), t1y = Math.floor(l.y1);
    const t2x = Math.floor(l.x2), t2y = Math.floor(l.y2);
    if (!dungeon.visible[t1y]?.[t1x] && !dungeon.visible[t2y]?.[t2x]) continue;
    const lAlpha = l.active && !l.disabled ? 0.6 : 0.2;
    ctx.globalAlpha = lAlpha;
    ctx.strokeStyle = '#ff6644';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 2; ctx.shadowColor = '#ff4422';
    ctx.beginPath();
    ctx.moveTo(MX + l.x1 * sx, MY + l.y1 * sy);
    ctx.lineTo(MX + l.x2 * sx, MY + l.y2 * sy);
    ctx.stroke();
    // Emitter dots
    ctx.fillStyle = '#ff6644';
    if (!l.deadA) { ctx.fillRect(MX + l.x1 * sx - 1, MY + l.y1 * sy - 1, 2, 2); }
    if (!l.deadB) { ctx.fillRect(MX + l.x2 * sx - 1, MY + l.y2 * sy - 1, 2, 2); }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  // Wall turrets — small dots (red-orange hostile, green hacked)
  for (const wt of wallTurrets) {
    if (wt.dead) continue;
    const tx = Math.floor(wt.x), ty = Math.floor(wt.y);
    if (!dungeon.visible[ty]?.[tx]) continue;
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = wt.hacked ? '#00ffaa' : '#ff4400';
    ctx.shadowBlur = 2; ctx.shadowColor = wt.hacked ? '#00cc88' : '#cc3300';
    ctx.fillRect(MX + wt.x * sx - 1, MY + wt.y * sy - 1, 2, 2);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  // Disruption fields — magenta pulsing dots
  for (const f of disruptionFields) {
    if (f.dead) continue;
    const tx = Math.floor(f.x), ty = Math.floor(f.y);
    if (!dungeon.visible[ty]?.[tx]) continue;
    ctx.globalAlpha = 0.4 + 0.3 * Math.sin((game.floorTime||0) * 4);
    ctx.shadowBlur = 3; ctx.shadowColor = '#ff44aa';
    ctx.fillStyle = '#ff44aa';
    ctx.fillRect(MX+f.x*sx-1, MY+f.y*sy-1, 2, 2);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  ctx.globalAlpha=1; ctx.shadowBlur=0;

  // player dot
  ctx.shadowBlur=6; ctx.shadowColor='#00f5ff';
  ctx.fillStyle='#00f5ff';
  ctx.fillRect(MX+player.x*sx-2,MY+player.y*sy-2,4,4);
  ctx.restore();
}

// ─── Expanded Minimap ─────────────────────────────────────────────────────────
const ROOM_ICONS = {
  armory:'⚔', medbay:'✚', shrine:'◈', vault:'◆', vendor:'$',
  secret:'?', challenge:'⚡', implant:'⬡', event:'◎', boss:'☠'
};
const ROOM_LABEL_COLOURS = {
  armory:'#ff8844', medbay:'#44ff88', shrine:'#cc66ff', vault:'#ffdd44',
  vendor:'#39ff14', secret:'#ffb700', challenge:'#ff6633', implant:'#cc44ff',
  event:'#44ffcc', boss:'#ff3333'
};

function drawExpandedMinimap(dungeon, player) {
  const pad = 20;
  const ratio = MAP_W / MAP_H; // 80/50 = 1.6
  // Fit to ~85% of screen, respecting safe areas
  const maxW = (W - 2 * pad - safeLeft - safeRight) * 0.85;
  const maxH = (H - 2 * pad - safeTop - safeBottom) * 0.85;
  let mw, mh;
  if (maxW / ratio <= maxH) { mw = maxW; mh = maxW / ratio; }
  else { mh = maxH; mw = maxH * ratio; }
  mw = Math.round(mw); mh = Math.round(mh);
  const mx = Math.round((W - mw) / 2);
  const my = Math.round((H - mh) / 2);
  const sx = mw / MAP_W, sy = mh / MAP_H;

  ctx.save();

  // Dim backdrop
  ctx.fillStyle = 'rgba(0,0,10,0.82)';
  ctx.fillRect(0, 0, W, H);

  // Map border
  ctx.strokeStyle = '#2d2d5e'; ctx.lineWidth = 2;
  ctx.strokeRect(mx - 2, my - 2, mw + 4, mh + 4);
  ctx.fillStyle = 'rgba(8,8,20,0.92)';
  ctx.fillRect(mx, my, mw, mh);

  const echoMap = game.mapRevealed;
  const thermalOptics = hasAugment('THERMAL_OPTICS');
  const pois = [];
  const roomCenters = [];

  // Tiles
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const visited = dungeon.visited[ty][tx];
      if (!visited && !echoMap) continue;
      const tile = dungeon.map[ty][tx];
      const px = mx + tx * sx, py = my + ty * sy;
      let col = null;

      if (!visited && echoMap) {
        if (dungeon.secretMask && dungeon.secretMask[ty][tx]) continue;
        if (tile === T.WALL || tile === T.CRACKED || tile === T.CRATE) col = '#0d0d1a';
        else if (isPassable(tile) || tile === T.DOOR) col = '#141428';
        if (col) { ctx.fillStyle = col; ctx.fillRect(px, py, Math.ceil(sx), Math.ceil(sy)); }
        continue;
      }

      if (tile === T.WALL || tile === T.CRACKED) {
        col = (game.bossSealed && game.bossEntrances.some(e => e.x === tx && e.y === ty)) ||
              (game.challengeSealed && game.challengeEntrances.some(e => e.x === tx && e.y === ty))
          ? '#5e2d2d' : '#1a1a2e';
      }
      else if (tile === T.FLOOR || tile === T.DOOR_OPEN || tile === T.TRAP_SPIKE || tile === T.TRAP_SLOW || tile === T.IMPLANT_SHRINE || tile === T.EVENT_TERMINAL || tile === T.TELEPORT_PAD) col = '#252545';
      else if (tile === T.PLASMA) col = '#ff6600';
      else if (tile === T.ARC) col = Math.sin((game.floorTime || 0) * Math.PI) > 0 ? '#44ccff' : '#1a3344';
      else if (tile === T.TOXIC) col = '#33ff00';
      else if (tile === T.STAIRS || tile === T.TERMINAL) col = '#ffff00';
      else if (tile === T.VENDOR) col = '#39ff14';
      else if (tile === T.LORE) col = '#ffb700';
      else if (tile === T.DOOR) col = '#664422';
      else if (tile === T.LOCKED_R) col = '#ff3333';
      else if (tile === T.LOCKED_B) col = '#3388ff';
      else if (tile === T.LOCKED_G) col = '#ffcc00';
      else if (tile === T.CHALLENGE_GATE) col = '#ff6633';
      else if (tile === T.CRATE) col = '#2a3a4e';
      if (col) { ctx.fillStyle = col; ctx.fillRect(px, py, Math.ceil(sx), Math.ceil(sy)); }

      if (tile === T.STAIRS || tile === T.TERMINAL || tile === T.VENDOR || tile === T.LORE ||
          tile === T.CHALLENGE_GATE || tile === T.IMPLANT_SHRINE || tile === T.EVENT_TERMINAL || tile === T.TELEPORT_PAD) {
        pois.push({ tile, px: px + sx / 2, py: py + sy / 2 });
      }
    }
  }

  // Room labels (visited special rooms only)
  const fs = Math.max(8, Math.min(12, Math.round(sx * 1.8)));
  ctx.font = `bold ${fs}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const r of dungeon.rooms) {
    if (!r.roomType) continue;
    // Skip unrevealed secret rooms
    if (r.roomType === 'secret' && (!r.secretRevealed)) continue;
    // Only show if room center is visited
    if (!dungeon.visited[r.cy]?.[r.cx]) continue;
    const type = (game.bossRoom && r === game.bossRoom) ? 'boss' : r.roomType;
    const icon = ROOM_ICONS[type] || '';
    const col = ROOM_LABEL_COLOURS[type] || '#aaaacc';
    const lx = mx + r.cx * sx + sx / 2;
    const ly = my + r.cy * sy + sy / 2;
    ctx.globalAlpha = 0.85;
    ctx.shadowBlur = 4; ctx.shadowColor = col;
    ctx.fillStyle = col;
    ctx.fillText(icon, lx, ly);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  // Boss room label
  if (game.bossRoom && dungeon.visited[game.bossRoom.cy]?.[game.bossRoom.cx]) {
    const br = game.bossRoom;
    const icon = ROOM_ICONS.boss;
    const col = ROOM_LABEL_COLOURS.boss;
    const lx = mx + br.cx * sx + sx / 2;
    const ly = my + br.cy * sy + sy / 2;
    ctx.globalAlpha = 0.9;
    ctx.shadowBlur = 6; ctx.shadowColor = col;
    ctx.fillStyle = col;
    ctx.fillText(icon, lx, ly);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  // Enemies
  const dotSz = Math.max(3, Math.round(sx * 0.5));
  for (const e of enemies) {
    if (e.dead) continue;
    if (e._disguised) continue; // disguised mimics hidden from expanded minimap
    // Phased WRAITHs: only show via Thermal Optics
    if (e._wrPhased) {
      if (!thermalOptics) continue;
      const wrPulse = 0.2 + 0.15 * Math.sin((game.floorTime||0) * 5);
      ctx.globalAlpha = wrPulse;
      ctx.fillStyle = '#66ffcc';
      const ex = mx + e.x * sx, ey = my + e.y * sy;
      ctx.fillRect(ex - dotSz * 0.5, ey - dotSz * 0.5, dotSz, dotSz);
      ctx.globalAlpha = 1;
      continue;
    }
    const tx = Math.floor(e.x), ty = Math.floor(e.y);
    const inSight = !!dungeon.visible[ty]?.[tx];
    if (!thermalOptics && !inSight) continue;
    const ex = mx + e.x * sx, ey = my + e.y * sy;
    if (e.isBoss) {
      const bPulse = 0.6 + 0.4 * Math.sin((game.floorTime || 0) * 4);
      ctx.globalAlpha = bPulse;
      ctx.shadowBlur = 8; ctx.shadowColor = '#ff3333';
      ctx.fillStyle = '#ff3333';
      ctx.fillRect(ex - dotSz, ey - dotSz, dotSz * 2, dotSz * 2);
    } else if (e._isBounty) {
      const bPulse2 = 0.7 + 0.3 * Math.sin((game.floorTime || 0) * 3);
      ctx.globalAlpha = bPulse2;
      ctx.shadowBlur = 6; ctx.shadowColor = '#ffd700';
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(ex - dotSz, ey - dotSz, dotSz * 2, dotSz * 2);
    } else if (e.elite && e.eliteAffix) {
      ctx.fillStyle = ELITE_AFFIXES[e.eliteAffix].colour;
      ctx.fillRect(ex - dotSz * 0.7, ey - dotSz * 0.7, dotSz * 1.4, dotSz * 1.4);
    } else {
      const vis = thermalOptics && !inSight;
      ctx.fillStyle = vis ? '#ff666688' : '#ff3333';
      ctx.fillRect(ex - dotSz * 0.5, ey - dotSz * 0.5, dotSz, dotSz);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  // Disruption fields — magenta dots
  for (const f of disruptionFields) {
    if (f.dead) continue;
    const tx = Math.floor(f.x), ty = Math.floor(f.y);
    if (!dungeon.visible[ty]?.[tx]) continue;
    const fPulse = 0.4 + 0.3 * Math.sin((game.floorTime||0) * 4);
    ctx.globalAlpha = fPulse;
    ctx.shadowBlur = 4; ctx.shadowColor = '#ff44aa';
    ctx.fillStyle = '#ff44aa';
    const fDot = Math.max(2, Math.round(sx * 0.4));
    ctx.fillRect(mx + f.x * sx - fDot / 2, my + f.y * sy - fDot / 2, fDot, fDot);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  // POI markers with labels
  const pulse = 0.65 + 0.35 * Math.sin((game.floorTime || 0) * 2.5);
  const poiFs = Math.max(7, Math.min(10, Math.round(sx * 1.4)));
  ctx.font = `${poiFs}px monospace`;
  for (const p of pois) {
    let col, label, sz = Math.max(4, Math.round(sx * 0.6));
    if (p.tile === T.STAIRS || p.tile === T.TERMINAL) { col = '#ffffff'; label = game.floor === 10 ? 'CORE' : 'EXIT'; }
    else if (p.tile === T.VENDOR) { col = '#39ff14'; label = 'SHOP'; }
    else if (p.tile === T.CHALLENGE_GATE) { col = '#ff6633'; label = 'CHALLENGE'; }
    else if (p.tile === T.IMPLANT_SHRINE) { col = '#cc44ff'; label = 'IMPLANT'; }
    else if (p.tile === T.EVENT_TERMINAL) { col = '#44ffcc'; label = 'EVENT'; }
    else if (p.tile === T.TELEPORT_PAD) { col = '#bb44ff'; label = 'WARP'; }
    else { col = '#ffb700'; label = 'LORE'; sz = Math.max(3, Math.round(sx * 0.45)); }
    ctx.globalAlpha = pulse;
    ctx.shadowBlur = 6; ctx.shadowColor = col;
    ctx.fillStyle = col;
    ctx.fillRect(p.px - sz / 2, p.py - sz / 2, sz, sz);
    // Label below marker
    ctx.textAlign = 'center';
    ctx.fillText(label, p.px, p.py + sz / 2 + poiFs + 1);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  // Sealed entrance markers
  if (game.bossSealed && game.bossEntrances) {
    const bPulse = 0.5 + 0.5 * Math.sin((game.floorTime || 0) * 4);
    ctx.globalAlpha = bPulse; ctx.shadowBlur = 6; ctx.shadowColor = '#ff3333'; ctx.fillStyle = '#ff3333';
    for (const be of game.bossEntrances) {
      if (!dungeon.visited[be.y]?.[be.x]) continue;
      ctx.fillRect(mx + be.x * sx + sx / 2 - 3, my + be.y * sy + sy / 2 - 3, 6, 6);
    }
  }
  if (game.challengeSealed && game.challengeEntrances) {
    const cPulse = 0.5 + 0.5 * Math.sin((game.floorTime || 0) * 3.5);
    ctx.globalAlpha = cPulse; ctx.shadowBlur = 6; ctx.shadowColor = '#ff6633'; ctx.fillStyle = '#ff6633';
    for (const ce of game.challengeEntrances) {
      if (!dungeon.visited[ce.y]?.[ce.x]) continue;
      ctx.fillRect(mx + ce.x * sx + sx / 2 - 3, my + ce.y * sy + sy / 2 - 3, 6, 6);
    }
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  // Player dot
  const pDot = Math.max(5, Math.round(sx * 0.8));
  ctx.shadowBlur = 10; ctx.shadowColor = '#00f5ff';
  ctx.fillStyle = '#00f5ff';
  ctx.fillRect(mx + player.x * sx - pDot / 2, my + player.y * sy - pDot / 2, pDot, pDot);
  ctx.shadowBlur = 0;

  // Title + hint
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.shadowBlur = 8; ctx.shadowColor = '#00f5ff';
  ctx.fillStyle = '#00f5ff'; ctx.font = 'bold 14px monospace';
  ctx.fillText(`FLOOR ${game.floor} MAP`, W / 2, my - 22);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#666688'; ctx.font = '11px monospace';
  const hint = isTouchDevice() ? 'TAP TO CLOSE' : 'TAB / ESC TO CLOSE';
  ctx.fillText(hint, W / 2, my + mh + 8);

  // Legend (bottom-left of map)
  const legendX = mx + 6, legendY = my + mh + 24;
  const lFs = Math.max(8, Math.min(10, fs - 1));
  ctx.font = `${lFs}px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const legend = [
    ['#00f5ff','● You'], ['#ff3333','● Enemy'], ['#ffffff','■ Exit'],
    ['#39ff14','■ Shop'], ['#ffb700','■ Lore'], ['#cc44ff','■ Implant'],
    ['#44ffcc','■ Event'], ['#ff6633','■ Challenge']
  ];
  let lx = legendX;
  for (const [col, label] of legend) {
    ctx.fillStyle = col;
    const tw = ctx.measureText(label).width;
    if (lx + tw > mx + mw) break;
    ctx.fillText(label, lx, legendY);
    lx += tw + 12;
  }

  ctx.restore();
}

// ─── Messages ─────────────────────────────────────────────────────────────────
let messages=[];
function drawMessages() {
  const msgFs = 16, msgLh = 22;
  for (let i=messages.length-1;i>=0;i--) {
    const m=messages[i];
    m.life-=1/60;
    if (m.life<=0){messages.splice(i,1);continue;}
    const mx = 14+safeLeft;
    const my = layout.msgBase-(messages.length-1-i)*msgLh;
    ctx.save();
    ctx.globalAlpha=Math.min(1,m.life);
    ctx.font=`bold ${msgFs}px monospace`;
    const tw = ctx.measureText(m.text).width;
    ctx.fillStyle='rgba(10,10,18,0.7)';
    ctx.fillRect(mx-4, my-msgFs+1, tw+8, msgFs+4);
    ctx.shadowBlur=8; ctx.shadowColor=m.colour;
    ctx.fillStyle=m.colour;
    ctx.fillText(m.text, mx, my);
    ctx.restore();
  }
}

function drawHint() {
  const h = game.hint;
  if (!h) return;
  const pulse = 0.55 + 0.35 * Math.sin(Date.now() / 300);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.shadowBlur = 10; ctx.shadowColor = h.colour;
  ctx.fillStyle = h.colour;
  ctx.font = '15px monospace'; ctx.textAlign = 'center';
  ctx.fillText(h.text, W / 2, layout.hudTop - 14);
  ctx.restore();
}

function drawThreatIndicators(camX, camY) {
  if (!game.player.perks.THREAT_SENSE) return;
  const px = game.player.x, py = game.player.y;
  const margin = 14;
  const viewL = camX / TILE, viewT = camY / TILE;
  const viewR = (camX + W) / TILE, viewB = (camY + H - layout.hudH) / TILE;
  const range = 18;

  for (const e of enemies) {
    if (e.dead) continue;
    if (e.type === 'PHANTOM' && !e.visible) continue;
    if (e._disguised) continue;
    if (e._wrPhased) continue;
    const dx = e.x - px, dy = e.y - py;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1 || d > range) continue;
    // Skip enemies already on screen
    if (e.x > viewL + 1 && e.x < viewR - 1 && e.y > viewT + 1 && e.y < viewB - 1) continue;

    const sx = e.x * TILE - camX, sy = e.y * TILE - camY;
    // Clamp to screen edges
    const cx = clamp(sx, margin, W - margin);
    const cy = clamp(sy, margin, H - layout.hudH - margin);
    const ang = Math.atan2(dy, dx);
    const proximity = 1 - (d - 1) / Math.max(range - 1, 1); // 1=close, 0=far
    const size = 5 + proximity * 3;
    const pulse = 0.35 + 0.35 * proximity + 0.2 * Math.sin(Date.now() / 200 + d);
    const col = e.isBoss ? '#ff3333' : '#ff6644';

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.globalAlpha = pulse;
    ctx.shadowBlur = 8; ctx.shadowColor = col;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.6, -size * 0.6);
    ctx.lineTo(-size * 0.6, size * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ─── Floor population ─────────────────────────────────────────────────────────
function populateFloor(dungeon, floorNum) {
  enemies=[]; items=[]; projectiles=[]; particles=[]; hazardZones=[]; pendingEnemySpawns=[]; floatingTexts=[]; ambientParticles=[]; hackwareEffects=[]; vcores=[]; crates=[]; beacons=[]; mines=[]; shieldGens=[]; cameras=[]; lasers=[]; wallTurrets=[]; disruptionFields=[]; gravityWells=[];
  shake.intensity=0; shake.timer=0; shake.ox=0; shake.oy=0;
  combo.count=0; combo.timer=0; combo.flashTimer=0;

  const spawnRoom=dungeon.spawnRoom;
  const bossRoom=dungeon.bossRoom;
  const BOSS_POOLS={3:['SENTINEL','WARDEN'],6:['HIVE','CONDUCTOR'],10:['OMEGA','GENESIS']};

  for (let i=0;i<dungeon.rooms.length;i++) {
    const room=dungeon.rooms[i];
    if (room===spawnRoom) continue;
    if (room.roomType==='secret') continue; // lazy-spawn on reveal
    if (room.roomType==='challenge') continue; // wave-spawned during encounter

    if (bossRoom && room===bossRoom) {
      const pool=BOSS_POOLS[floorNum];
      const btype=pool?pool[Math.floor(Math.random()*pool.length)]:null;
      if (btype) {
        const b=spawnEnemy(btype,room.cx,room.cy,floorNum,room);
        enemies.push(b);
        game.bossRoom=bossRoom;
        game.bossType=btype;
        game.bossEntrances=dungeon.bossEntrances||[];
        game.bossSealed=false;
        game.bossAlive=true;
      }
      continue;
    }

    // Room type modifiers
    const rt = room.roomType || null;
    const enemyMod = rt==='medbay' ? 0.3 : rt==='vault' ? 1.5 : rt==='armory' ? 0.5 : 1;

    // Destructible crates (floor 2+, normal rooms only, 0–2 per room)
    if (floorNum >= 2 && !rt && room.w >= 6 && room.h >= 6) {
      const crateCount = rndInt(0, 2);
      for (let j = 0; j < crateCount; j++) {
        // Interior positions only — 2 tiles from room boundary
        const cx = room.x + rndInt(2, room.w - 3);
        const cy = room.y + rndInt(2, room.h - 3);
        if (dungeon.map[cy]?.[cx] !== T.FLOOR) continue;
        // Not adjacent to doors or stairs (manhattan ≤ 1)
        let nearDoor = false;
        for (let dy = -1; dy <= 1 && !nearDoor; dy++) {
          for (let dx = -1; dx <= 1 && !nearDoor; dx++) {
            const nt = dungeon.map[cy + dy]?.[cx + dx];
            if (isDoor(nt) || nt === T.STAIRS || nt === T.DOOR_OPEN) nearDoor = true;
          }
        }
        if (nearDoor) continue;
        // Not adjacent to another crate
        let nearCrate = false;
        for (let dy = -1; dy <= 1 && !nearCrate; dy++) {
          for (let dx = -1; dx <= 1 && !nearCrate; dx++) {
            if (dy === 0 && dx === 0) continue;
            if (dungeon.map[cy + dy]?.[cx + dx] === T.CRATE) nearCrate = true;
          }
        }
        if (nearCrate) continue;
        dungeon.map[cy][cx] = T.CRATE;
        crates.push(createCrate(cx, cy, floorNum));
      }
    }

    // Alarm beacons (floor 4+, normal rooms only, ~40% chance, 0–1 per room)
    if (floorNum >= 4 && !rt && room.w >= 5 && room.h >= 5 && Math.random() < 0.4) {
      const bx = room.x + rndInt(2, room.w - 3) + 0.5;
      const by = room.y + rndInt(2, room.h - 3) + 0.5;
      const btx = Math.floor(bx), bty = Math.floor(by);
      if (dungeon.map[bty]?.[btx] === T.FLOOR) {
        beacons.push(createBeacon(bx, by, floorNum, room));
        room._hadEnemies = true; // ensure room-clear tracking covers beacon rooms
      }
    }

    // Proximity mines (floor 3+, normal rooms only, ~40% chance, 0–1 per room)
    if (floorNum >= 3 && !rt && room.w >= 5 && room.h >= 5 && Math.random() < 0.4) {
      const mx = room.x + rndInt(2, room.w - 3) + 0.5;
      const my = room.y + rndInt(2, room.h - 3) + 0.5;
      const mtx = Math.floor(mx), mty = Math.floor(my);
      if (dungeon.map[mty]?.[mtx] === T.FLOOR) {
        // Not near beacons, vcores, or crates (1.5+ tile spacing)
        let tooClose = false;
        for (const b of beacons) { if (dist(mx, my, b.x, b.y) < 1.5) { tooClose = true; break; } }
        if (!tooClose) for (const v of vcores) { if (dist(mx, my, v.x, v.y) < 1.5) { tooClose = true; break; } }
        if (!tooClose) for (const c of crates) { if (dist(mx, my, c.tx + 0.5, c.ty + 0.5) < 1.5) { tooClose = true; break; } }
        if (!tooClose) mines.push(createMine(mx, my, floorNum, room));
      }
    }

    // Enemy count scales with floor, capped by room area
    const minE = 2 + Math.floor(floorNum / 3);
    const maxE = Math.min(8, 4 + Math.floor(floorNum / 2));
    const areaCap = Math.floor(room.w * room.h / 8);
    let count = Math.min(areaCap, Math.round(rndInt(minE, maxE) * enemyMod));
    if (game.modifier === 'SWARM') count = Math.min(areaCap, Math.ceil(count * 1.5));

    let roomElite = false;  // max 1 elite per room
    let spawnedCount = 0;
    const typeCounts = {};  // per-type caps within room
    const TYPE_CAPS = { PHANTOM: 2, TURRET: 2, DRONE: 2, SHIELDER: 1, SPLITTER: 2, GRENADIER: 1, TELEPORTER: 1, SNIPER: 1, SUMMONER: 1, HEALER: 1, CHARGER: 2, LEAPER: 2, REFLECTOR: 1, DISRUPTOR: 1, WRAITH: 1, NEXUS: 1, SIPHON: 1, GRAVITON: 1, SEEKER: 3, PULSER: 2 };
    for (let j=0;j<count;j++) {
      let type = pickEnemyType(floorNum);
      // Per-type room caps — reroll among uncapped, floor-eligible types if hit
      if ((typeCounts[type] || 0) >= (TYPE_CAPS[type] || 99)) {
        const open = ENEMY_TYPES_LIST.filter(t =>
          (typeCounts[t] || 0) < (TYPE_CAPS[t] || 99) &&
          !(ENEMY_WEIGHTS[t].minFloor && floorNum < ENEMY_WEIGHTS[t].minFloor)
        );
        type = open.length ? open[rndInt(0, open.length - 1)] : 'GUARD';
      }

      const ex=room.x+rnd(1,room.w-1), ey=room.y+rnd(1,room.h-1);
      if (!isPassable(dungeon.map[Math.floor(ey)]?.[Math.floor(ex)])) continue;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      const e = spawnEnemy(type,ex,ey,floorNum,room, !roomElite);
      if (e.elite) roomElite = true;
      enemies.push(e);
      spawnedCount++;
    }
    if (spawnedCount > 0) room._hadEnemies = true;

    const itemCount=rndInt(0, getDiff().roomLoot) + (room.hasLoot ? 2 : 0); // locked rooms get bonus loot
    for (let j=0;j<itemCount;j++) {
      const ix=room.x+rnd(1,room.w-1), iy=room.y+rnd(1,room.h-1);
      if (!isPassable(dungeon.map[Math.floor(iy)]?.[Math.floor(ix)])) continue;
      items.push(new Item(ix,iy));
    }

    // Volatile cores (floors 3+, normal rooms only, 0–2 per room)
    if (floorNum >= 3 && !rt) {
      const coreCount = rndInt(0, 2);
      for (let j = 0; j < coreCount; j++) {
        const cx = room.x + rnd(1, room.w - 1);
        const cy = room.y + rnd(1, room.h - 1);
        const tile = dungeon.map[Math.floor(cy)]?.[Math.floor(cx)];
        if (tile === T.FLOOR) vcores.push(createVCore(cx, cy));
      }
    }

    // Shield generators (floor 5+, normal rooms with ≥3 enemies, ~30% chance, not in beacon rooms)
    if (floorNum >= 5 && !rt && spawnedCount >= 3 && room.w >= 5 && room.h >= 5 && Math.random() < 0.3) {
      const hasBeacon = beacons.some(b => b.room === room);
      if (!hasBeacon) {
        const gx = room.x + rndInt(2, room.w - 3) + 0.5;
        const gy = room.y + rndInt(2, room.h - 3) + 0.5;
        const gtx = Math.floor(gx), gty = Math.floor(gy);
        if (dungeon.map[gty]?.[gtx] === T.FLOOR) {
          // Not near other environmental objects (1.5+ tile spacing)
          let tooClose = false;
          for (const b of beacons) { if (dist(gx, gy, b.x, b.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const v of vcores) { if (dist(gx, gy, v.x, v.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const c of crates) { if (dist(gx, gy, c.tx + 0.5, c.ty + 0.5) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const m of mines) { if (dist(gx, gy, m.x, m.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) shieldGens.push(createShieldGen(gx, gy, floorNum, room));
        }
      }
    }

    // Security cameras (floor 4+, normal rooms, ~30% chance, not in beacon rooms, room ≥6×6)
    if (floorNum >= 4 && !rt && room.w >= 6 && room.h >= 6 && Math.random() < 0.3) {
      const hasBeacon = beacons.some(b => b.room === room);
      if (!hasBeacon) {
        // Find valid wall mount points: interior floor tile adjacent to solid wall, not near doors/corners
        const mounts = [];
        const m = dungeon.map;
        for (let ty = room.y + 1; ty < room.y + room.h - 1; ty++) {
          for (let tx = room.x + 1; tx < room.x + room.w - 1; tx++) {
            if (m[ty]?.[tx] !== T.FLOOR) continue;
            // Check each cardinal direction for an adjacent wall
            const dirs = [
              { dx: 0, dy: -1, side: 'N' },
              { dx: 0, dy: 1,  side: 'S' },
              { dx: -1, dy: 0, side: 'W' },
              { dx: 1, dy: 0,  side: 'E' },
            ];
            for (const { dx, dy, side } of dirs) {
              const adjTile = m[ty + dy]?.[tx + dx];
              if (adjTile !== T.WALL) continue;
              // Not near doors (manhattan ≤ 1)
              let nearDoor = false;
              for (let ddy = -1; ddy <= 1 && !nearDoor; ddy++) {
                for (let ddx = -1; ddx <= 1 && !nearDoor; ddx++) {
                  const nt = m[ty + ddy]?.[tx + ddx];
                  if (isDoor(nt) || nt === T.DOOR_OPEN || nt === T.STAIRS) nearDoor = true;
                }
              }
              if (nearDoor) continue;
              // Not a corner tile (avoid awkward 2-wall adjacency)
              let wallCount = 0;
              if (m[ty - 1]?.[tx] === T.WALL) wallCount++;
              if (m[ty + 1]?.[tx] === T.WALL) wallCount++;
              if (m[ty]?.[tx - 1] === T.WALL) wallCount++;
              if (m[ty]?.[tx + 1] === T.WALL) wallCount++;
              if (wallCount > 1) continue;
              mounts.push({ tx, ty, side });
            }
          }
        }
        if (mounts.length > 0) {
          const pick = mounts[rndInt(0, mounts.length - 1)];
          const cx = pick.tx + 0.5, cy = pick.ty + 0.5;
          // Not near other environmental objects
          let tooClose = false;
          for (const b of beacons) { if (dist(cx, cy, b.x, b.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const v of vcores) { if (dist(cx, cy, v.x, v.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const c of crates) { if (dist(cx, cy, c.tx + 0.5, c.ty + 0.5) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const mn of mines) { if (dist(cx, cy, mn.x, mn.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const g of shieldGens) { if (dist(cx, cy, g.x, g.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) cameras.push(createCamera(cx, cy, floorNum, room, pick.side));
        }
      }
    }

    // Laser tripwires (floor 3+, normal rooms, ~25% chance, not in beacon/camera rooms, room ≥ 5 wide or tall)
    if (floorNum >= 3 && !rt && (room.w >= 5 || room.h >= 5) && Math.random() < 0.25) {
      const hasBeacon = beacons.some(b => b.room === room);
      const hasCamera = cameras.some(c => c.room === room);
      if (!hasBeacon && !hasCamera) {
        // Find valid beam paths: pairs of wall-adjacent floor tiles with clear path between
        const beamCandidates = [];
        const m = dungeon.map;
        // Horizontal beams: scan rows for wall-floor...floor-wall spans
        for (let ty = room.y + 1; ty < room.y + room.h - 1; ty++) {
          let left = -1;
          for (let tx = room.x; tx < room.x + room.w; tx++) {
            if (m[ty]?.[tx] === T.FLOOR && m[ty]?.[tx - 1] === T.WALL && left < 0) {
              left = tx;
            }
          }
          if (left >= 0) {
            // Find rightmost floor tile in same row with wall to the right
            for (let tx = room.x + room.w - 1; tx > left + 2; tx--) {
              if (m[ty]?.[tx] === T.FLOOR && m[ty]?.[tx + 1] === T.WALL) {
                // Check all tiles between are floor
                let clear = true;
                for (let bx = left; bx <= tx; bx++) {
                  if (m[ty]?.[bx] !== T.FLOOR) { clear = false; break; }
                }
                if (clear) {
                  // Not near doors
                  let nearDoor = false;
                  for (let ddx = -1; ddx <= 1 && !nearDoor; ddx++) {
                    if (isDoor(m[ty]?.[left + ddx]) || isDoor(m[ty]?.[tx + ddx])) nearDoor = true;
                    if (m[ty]?.[left + ddx] === T.DOOR_OPEN || m[ty]?.[tx + ddx] === T.DOOR_OPEN) nearDoor = true;
                  }
                  for (let ddy = -1; ddy <= 1 && !nearDoor; ddy++) {
                    if (isDoor(m[ty + ddy]?.[left]) || isDoor(m[ty + ddy]?.[tx])) nearDoor = true;
                    if (m[ty + ddy]?.[left] === T.DOOR_OPEN || m[ty + ddy]?.[tx] === T.DOOR_OPEN) nearDoor = true;
                  }
                  if (!nearDoor && tx - left >= 3) {
                    beamCandidates.push({ x1: left + 0.5, y1: ty + 0.5, x2: tx + 0.5, y2: ty + 0.5, axis: 'H' });
                  }
                }
                break;
              }
            }
          }
        }
        // Vertical beams: scan columns for wall-floor...floor-wall spans
        for (let tx = room.x + 1; tx < room.x + room.w - 1; tx++) {
          let top = -1;
          for (let ty = room.y; ty < room.y + room.h; ty++) {
            if (m[ty]?.[tx] === T.FLOOR && m[ty - 1]?.[tx] === T.WALL && top < 0) {
              top = ty;
            }
          }
          if (top >= 0) {
            for (let ty = room.y + room.h - 1; ty > top + 2; ty--) {
              if (m[ty]?.[tx] === T.FLOOR && m[ty + 1]?.[tx] === T.WALL) {
                let clear = true;
                for (let by = top; by <= ty; by++) {
                  if (m[by]?.[tx] !== T.FLOOR) { clear = false; break; }
                }
                if (clear) {
                  let nearDoor = false;
                  for (let ddy = -1; ddy <= 1 && !nearDoor; ddy++) {
                    if (isDoor(m[top + ddy]?.[tx]) || isDoor(m[ty + ddy]?.[tx])) nearDoor = true;
                    if (m[top + ddy]?.[tx] === T.DOOR_OPEN || m[ty + ddy]?.[tx] === T.DOOR_OPEN) nearDoor = true;
                  }
                  for (let ddx = -1; ddx <= 1 && !nearDoor; ddx++) {
                    if (isDoor(m[top]?.[tx + ddx]) || isDoor(m[ty]?.[tx + ddx])) nearDoor = true;
                    if (m[top]?.[tx + ddx] === T.DOOR_OPEN || m[ty]?.[tx + ddx] === T.DOOR_OPEN) nearDoor = true;
                  }
                  if (!nearDoor && ty - top >= 3) {
                    beamCandidates.push({ x1: tx + 0.5, y1: top + 0.5, x2: tx + 0.5, y2: ty + 0.5, axis: 'V' });
                  }
                }
                break;
              }
            }
          }
        }
        if (beamCandidates.length > 0) {
          const pick = beamCandidates[rndInt(0, beamCandidates.length - 1)];
          // Not too close to other environmental objects
          let tooClose = false;
          for (const b of beacons) { if (dist(pick.x1, pick.y1, b.x, b.y) < 1.5 || dist(pick.x2, pick.y2, b.x, b.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const v of vcores) { if (dist(pick.x1, pick.y1, v.x, v.y) < 1.5 || dist(pick.x2, pick.y2, v.x, v.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const mn of mines) { if (dist(pick.x1, pick.y1, mn.x, mn.y) < 1.5 || dist(pick.x2, pick.y2, mn.x, mn.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const g of shieldGens) { if (dist(pick.x1, pick.y1, g.x, g.y) < 1.5 || dist(pick.x2, pick.y2, g.x, g.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) {
            const cycling = Math.random() < 0.2;
            lasers.push(createLaser(pick.x1, pick.y1, pick.x2, pick.y2, floorNum, room, pick.axis, cycling));
          }
        }
      }
    }

    // Wall turrets (floor 5+, normal rooms, ~25% chance, not in camera rooms, room ≥6×6)
    if (floorNum >= 5 && !rt && room.w >= 6 && room.h >= 6 && Math.random() < 0.25) {
      const hasCamera = cameras.some(c => c.room === room);
      if (!hasCamera) {
        // Reuse camera wall-mount algorithm: interior floor adjacent to wall, not near doors/corners
        const mounts = [];
        const m = dungeon.map;
        for (let ty = room.y + 1; ty < room.y + room.h - 1; ty++) {
          for (let tx = room.x + 1; tx < room.x + room.w - 1; tx++) {
            if (m[ty]?.[tx] !== T.FLOOR) continue;
            const dirs = [
              { dx: 0, dy: -1, side: 'N' },
              { dx: 0, dy: 1,  side: 'S' },
              { dx: -1, dy: 0, side: 'W' },
              { dx: 1, dy: 0,  side: 'E' },
            ];
            for (const { dx, dy, side } of dirs) {
              if (m[ty + dy]?.[tx + dx] !== T.WALL) continue;
              let nearDoor = false;
              for (let ddy = -1; ddy <= 1 && !nearDoor; ddy++) {
                for (let ddx = -1; ddx <= 1 && !nearDoor; ddx++) {
                  const nt = m[ty + ddy]?.[tx + ddx];
                  if (isDoor(nt) || nt === T.DOOR_OPEN || nt === T.STAIRS) nearDoor = true;
                }
              }
              if (nearDoor) continue;
              let wallCount = 0;
              if (m[ty - 1]?.[tx] === T.WALL) wallCount++;
              if (m[ty + 1]?.[tx] === T.WALL) wallCount++;
              if (m[ty]?.[tx - 1] === T.WALL) wallCount++;
              if (m[ty]?.[tx + 1] === T.WALL) wallCount++;
              if (wallCount > 1) continue;
              mounts.push({ tx, ty, side });
            }
          }
        }
        // Shuffle and pick 1-2 turrets
        for (let i = mounts.length - 1; i > 0; i--) { const j = rndInt(0, i); [mounts[i], mounts[j]] = [mounts[j], mounts[i]]; }
        const count = Math.min(rndInt(1, 2), mounts.length);
        for (let k = 0; k < count; k++) {
          const pick = mounts[k];
          const cx = pick.tx + 0.5, cy = pick.ty + 0.5;
          let tooClose = false;
          for (const b of beacons)    { if (dist(cx, cy, b.x, b.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const v of vcores)  { if (dist(cx, cy, v.x, v.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const c2 of crates) { if (dist(cx, cy, c2.tx + 0.5, c2.ty + 0.5) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const mn of mines)  { if (dist(cx, cy, mn.x, mn.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const g of shieldGens) { if (dist(cx, cy, g.x, g.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const cm of cameras) { if (dist(cx, cy, cm.x, cm.y) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const l of lasers)  { if (dist(cx, cy, l.x1, l.y1) < 1.5 || dist(cx, cy, l.x2, l.y2) < 1.5) { tooClose = true; break; } }
          if (!tooClose) for (const wt of wallTurrets) { if (dist(cx, cy, wt.x, wt.y) < 2.5) { tooClose = true; break; } }
          if (!tooClose) {
            wallTurrets.push(createWallTurret(cx, cy, floorNum, room, pick.side));
            room._hadEnemies = true; // hostile turrets block room-clear
          }
        }
      }
    }

    // Special room bonuses
    if (rt==='medbay') {
      // Place a healing font (persistent heal tile) in center
      dungeon.map[room.cy][room.cx] = T.FLOOR; // keep walkable
      room.healFont = true; // flag checked during gameplay
    }
    if (rt==='shrine') {
      room.xpShrine = true;
    }
    if (rt==='vendor') {
      // Generate shop inventory for this vendor room
      room.shopItems = generateShopItems(floorNum, game.player, dungeon);
      room.vendorVisited = false;
    }
    if (rt==='event') {
      room.eventUsed = false;
    }
  }

  // Boss-floor flag (used by mimic spawn and bounty designation)
  const isBossFloor = floorNum === 3 || floorNum === 6 || floorNum === 10;

  // Mimic spawn (floor 7+, non-boss, 50% chance, max 1 per floor)
  if (floorNum >= 7 && !isBossFloor && Math.random() < 0.5) {
    const mimicRooms = dungeon.rooms.filter(r =>
      r !== dungeon.spawnRoom && r !== dungeon.bossRoom &&
      !r.roomType && r.w * r.h >= 16
    );
    if (mimicRooms.length > 0) {
      const mr = mimicRooms[rndInt(0, mimicRooms.length - 1)];
      const mx = mr.x + rnd(1, mr.w - 1), my = mr.y + rnd(1, mr.h - 1);
      if (isPassable(dungeon.map[Math.floor(my)]?.[Math.floor(mx)])) {
        const m = spawnEnemy('MIMIC', mx, my, floorNum, mr, false);
        enemies.push(m);
      }
    }
  }

  // Bounty target designation (floor 2+, non-boss floors)
  if (floorNum >= 2 && !isBossFloor) {
    const candidates = enemies.filter(e => !e.isBoss && !e.isShard && !e.elite && !e._summoned && !e._disguised);
    if (candidates.length > 0) {
      const bounty = candidates[rndInt(0, candidates.length - 1)];
      bounty._isBounty = true;
      bounty._bountyRevealed = false;
      bounty.hp = Math.round(bounty.hp * 2);
      bounty.maxHp = bounty.hp;
      bounty.atk = Math.round(bounty.atk * 1.5);
    }
  }

  // Place key items from dungeon generator
  if (dungeon.keyItems) {
    for (const ki of dungeon.keyItems) {
      items.push(new KeyItem(ki.x, ki.y, ki.colour, ki.tileColour));
    }
  }
}

// ─── Game State Machine ───────────────────────────────────────────────────────
