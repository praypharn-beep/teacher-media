// เทสเกม "มังกรมาตรา" (J1784256147282)
//
// สองเรื่องนี้เคยพังจริงและแก้ไปแล้ว เทสอยู่ตรงนี้เพื่อกันไม่ให้กลับมาอีก
//   1. กด "เริ่มใหม่" ระหว่างเล่น ทำให้ animation loop เดินซ้อนกัน คำร่วงเร็วทวีคูณ
//   2. คำบนกระดานเป็น <div> ที่ Tab ไปไม่ถึง เด็กที่ไม่มีเมาส์/กล้องเล่นไม่ได้เลย

import assert from "node:assert/strict";
import test from "node:test";

import { loadGame } from "./helpers/game-harness.mjs";

const GAME = "J1784256147282.html";

async function startInTouchMode() {
  const game = await loadGame(GAME);
  const touchBtn = game.$("#touchBtn");
  assert.ok(touchBtn, "ต้องมีปุ่มเล่นแบบไม่ใช้กล้อง");
  assert.equal(touchBtn.tagName, "BUTTON", "ปุ่มต้องเป็น <button> จริง ไม่งั้นคีย์บอร์ดกดไม่ได้");
  touchBtn.click();
  game.flushTimers();
  return game;
}

test("กดเริ่มใหม่ระหว่างเล่นต้องไม่ทำให้ animation loop เดินซ้อนกัน", async () => {
  const game = await startInTouchMode();

  const duringPlay = game.stepFrames(5);
  assert.deepEqual(duringPlay, [1, 1, 1, 1, 1], "ระหว่างเล่นปกติต้องมี loop เดียว");

  const restartBtn = game.$("#restartBtn");
  assert.ok(restartBtn, "ต้องมีปุ่มเริ่มใหม่");

  restartBtn.click();
  assert.deepEqual(
    game.stepFrames(5),
    [1, 1, 1, 1, 1],
    "หลังกดเริ่มใหม่ 1 ครั้ง ยังต้องมี loop เดียว",
  );

  // เด็กใจร้อนกดรัว
  restartBtn.click();
  restartBtn.click();
  assert.deepEqual(
    game.stepFrames(5),
    [1, 1, 1, 1, 1],
    "กดเริ่มใหม่รัว ๆ ก็ยังต้องมี loop เดียว ไม่งั้นคำจะร่วงเร็วเป็นทวีคูณ",
  );
});

test("ทุกคำบนกระดานต้อง Tab ไปถึงได้", async () => {
  const game = await startInTouchMode();

  const tiles = game.$$(".word");
  assert.ok(tiles.length > 0, "ต้องมีคำอยู่บนกระดาน");

  const unreachable = tiles.filter((el) => el.tabIndex !== 0);
  assert.equal(
    unreachable.length,
    0,
    `มีคำที่ Tab ไปไม่ถึง ${unreachable.length} จาก ${tiles.length} คำ`,
  );
});

test("เล่นจนจบเกมได้ด้วยคีย์บอร์ดล้วน", async () => {
  const game = await startInTouchMode();

  let rounds = 0;
  let focusFollowed = false;

  while (game.$("#finishOverlay")?.classList.contains("hidden") !== false) {
    assert.ok(++rounds <= 400, "เล่นไม่จบใน 400 รอบ คีย์บอร์ดน่าจะสั่งอะไรไม่ได้");

    const tiles = game.$$(".word");
    if (tiles.length === 0) {
      game.flushTimers();
      continue;
    }

    for (const tile of tiles) {
      if (!tile.isConnected) continue;
      game.pressKey(tile, "Enter");
      const active = game.document.activeElement;
      if (active?.classList.contains("word")) focusFollowed = true;
      game.flushTimers();
    }
    game.flushTimers();
  }

  assert.ok(
    focusFollowed,
    "หลังป้อนคำถูก โฟกัสต้องเลื่อนไปคำถัดไปเอง ไม่งั้นผู้เล่นคีย์บอร์ดจะหลงทาง",
  );

  const finalScore = game.$("#finalScore")?.textContent ?? "";
  assert.match(finalScore, /32 จาก 32/, `ต้องเก็บครบทุกคำ แต่ได้: ${finalScore}`);
});
