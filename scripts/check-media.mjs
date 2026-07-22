// ตรวจความถูกต้องเชิงโครงสร้างของคลังสื่อ — ไม่ใช้ dependency ใด ๆ
//
//   node scripts/check-media.mjs
//
// ตรวจสิ่งที่ตอบได้ด้วยการเทียบไฟล์ตรง ๆ ไม่ต้องใช้ AI และไม่ต้อง npm install
// จุดประสงค์หลักคือกันเหตุการณ์ "ทำเกมเสร็จ อัปขึ้นแล้ว แต่ลืมลงทะเบียนใน
// library.json ครูเลยมองไม่เห็น" ซึ่งเคยเกิดขึ้นจริงกับ J1784395741990

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "..");

const SITE_BASE = "https://praypharn-beep.github.io/teacher-media/games/";

const problems = [];
const notes = [];

function problem(message) {
  problems.push(message);
}

async function main() {
  const library = JSON.parse(await readFile(path.join(root, "library.json"), "utf8"));
  const gameFiles = (await readdir(path.join(root, "games"))).filter((f) => f.endsWith(".html"));
  const gameIds = gameFiles.map((f) => f.replace(/\.html$/, ""));
  const listedIds = library.map((item) => item.jobId);

  // 1. เกมที่มีไฟล์แต่ไม่ได้ลงทะเบียน = ครูมองไม่เห็นบนหน้าเว็บ
  for (const id of gameIds) {
    if (!listedIds.includes(id)) {
      problem(`games/${id}.html มีไฟล์อยู่ แต่ไม่มีใน library.json — ครูจะมองไม่เห็นเกมนี้`);
    }
  }

  // 2. รายการที่ชี้ไปไฟล์ที่ไม่มีจริง = กดแล้วเจอ 404
  for (const id of listedIds) {
    if (!gameIds.includes(id)) {
      problem(`library.json มี ${id} แต่ไม่มีไฟล์ games/${id}.html — กดแล้วจะเจอหน้า 404`);
    }
  }

  // 3. url ต้องตรงกับ jobId ของตัวเอง คัดลอกรายการเดิมมาแก้แล้วลืมเปลี่ยน url เป็นเรื่องปกติ
  for (const item of library) {
    const expected = `${SITE_BASE}${item.jobId}.html`;
    if (item.url !== expected) {
      problem(`${item.jobId}: url ไม่ตรงกับ jobId\n      ที่มี:  ${item.url}\n      ที่ควรเป็น: ${expected}`);
    }
  }

  // 4. ตรวจ HTML ของแต่ละเกมเท่าที่ตรวจได้ด้วยการอ่านข้อความ
  for (const file of gameFiles) {
    const html = await readFile(path.join(root, "games", file), "utf8");
    const where = `games/${file}`;

    if (!/<title>[^<]+<\/title>/.test(html)) {
      problem(`${where}: ไม่มี <title> หน้าแท็บจะไม่มีชื่อ`);
    }
    if (!/<html[^>]+lang=["']th["']/.test(html)) {
      problem(`${where}: ไม่มี lang="th" โปรแกรมอ่านหน้าจอจะอ่านภาษาไทยผิดสำเนียง`);
    }
    if (!/<meta[^>]+name=["']viewport["']/.test(html)) {
      problem(`${where}: ไม่มี viewport meta หน้าจะเพี้ยนบนมือถือและแท็บเล็ต`);
    }

    // ลิงก์ http:// ธรรมดาจะถูกเบราว์เซอร์บล็อกเพราะเว็บเราเป็น https
    const insecure = html.match(/(?:src|href)=["']http:\/\/[^"']+/g);
    if (insecure) {
      problem(`${where}: อ้างอิง http:// ซึ่งจะโดนบล็อกบนเว็บ https\n      ${insecure[0]}`);
    }
  }

  notes.push(`ไฟล์เกม ${gameFiles.length} ไฟล์ / รายการใน library.json ${library.length} รายการ`);
}

await main();

for (const note of notes) {
  console.log(note);
}

if (problems.length === 0) {
  console.log("ผ่านทั้งหมด: คลังสื่อสอดคล้องกันดี");
} else {
  console.error(`\nพบปัญหา ${problems.length} จุด`);
  for (const p of problems) {
    console.error(`  - ${p}`);
  }
  process.exitCode = 1;
}
