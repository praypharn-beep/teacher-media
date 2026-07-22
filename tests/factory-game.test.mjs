// เทสเกม "โรงงานแบ่งของ" (J1784413532215)
//
// ดาวความพยายามเคยคำนวณจาก state.score ซึ่งจบเกมได้ก็ต่อเมื่อตอบถูกครบทุกข้อ
// ค่าจึงเท่ากับ 12 เสมอ ทุกคนได้ 3 ดาวเท่ากันหมดไม่ว่าจะตอบผิดกี่ครั้ง
// เทสนี้เล่นจนจบจริงโดยเดาคำตอบไปเรื่อย ๆ (ตอบผิดเยอะมาก) แล้วยืนยันว่าได้ดาวน้อย

import assert from "node:assert/strict";
import test from "node:test";

import { loadGame } from "./helpers/game-harness.mjs";

const GAME = "J1784413532215.html";

// เล่นจนจบโดยไล่ลองคำตอบทีละค่า คืนจำนวนครั้งที่ตอบผิดกับจำนวนดาวที่ได้
async function playByBruteForce() {
  const game = await loadGame(GAME);
  game.$("#startBtn").click();
  game.flushTimers();

  let wrong = 0;
  let guard = 0;

  const submit = () => {
    game.$("#checkBtn").click();
    const correct = game.$("#feedback").className.includes("correct");
    if (!correct) wrong++;
    game.flushTimers();
    return correct;
  };

  while (!game.$("#endScreen").classList.contains("active")) {
    assert.ok(++guard <= 200, "เล่นไม่จบ อาจติดลูป");

    if (game.$("#stageOneValue")) {
      // ด่านนับจำนวน: กด +/- ไล่ค่าตั้งแต่ 1 ถึง 12
      let solved = false;
      for (let value = 1; value <= 12 && !solved; value++) {
        while (Number(game.$("#stageOneValue").textContent) > value) game.$("#minusBtn").click();
        while (Number(game.$("#stageOneValue").textContent) < value) game.$("#plusBtn").click();
        solved = submit();
      }
      assert.ok(solved, "ด่าน 1 หาคำตอบไม่เจอ");
    } else if (game.$("#quotientInput")) {
      // ด่านกรอกผลหารและเศษ
      let solved = false;
      for (let q = 0; q <= 12 && !solved; q++) {
        for (let r = 0; r <= 11 && !solved; r++) {
          game.$("#quotientInput").value = String(q);
          game.$("#remainderInput").value = String(r);
          solved = submit();
        }
      }
      assert.ok(solved, "ด่าน 2 หาคำตอบไม่เจอ");
    } else {
      // ด่านเลือกตัวเลือก
      let solved = false;
      for (const choice of game.$$(".choice")) {
        choice.click();
        solved = submit();
        if (solved) break;
      }
      assert.ok(solved, "ด่าน 3 หาคำตอบไม่เจอ");
    }
  }

  return { wrong, stars: game.$("#starLine").textContent.trim().length };
}

test("ตอบผิดเยอะต้องได้ดาวน้อยลง ไม่ใช่ 3 ดาวเสมอ", async () => {
  const { wrong, stars } = await playByBruteForce();

  assert.ok(wrong > 4, `เทสนี้ต้องตอบผิดเกิน 4 ครั้งถึงจะมีความหมาย แต่ผิดแค่ ${wrong} ครั้ง`);
  assert.equal(stars, 1, `ตอบผิด ${wrong} ครั้ง ควรได้ 1 ดาว แต่ได้ ${stars} ดาว`);
});

// หมายเหตุ: ยังไม่มีเทสฝั่งตรงข้าม (เล่นไม่ผิดเลยต้องได้ 3 ดาว) เพราะเทสไม่รู้
// คำตอบล่วงหน้า จึงเล่นแบบไม่ผิดเลยไม่ได้ ถ้าจะปิดช่องนี้ต้องแยกสูตรคิดดาว
// ออกมาเป็นฟังก์ชันที่ import มาทดสอบตรง ๆ ได้
