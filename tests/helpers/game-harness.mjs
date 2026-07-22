// ตัวช่วยโหลดไฟล์เกมเข้า jsdom เพื่อทดสอบตรรกะการเล่นแบบอัตโนมัติ
//
// เกมพวกนี้เป็น HTML ไฟล์เดียวจบ ไม่มี module ให้ import ทดสอบตรง ๆ ได้
// จึงต้องโหลดทั้งหน้าแล้วสั่งงานผ่าน DOM เหมือนผู้เล่นจริง
//
// ทุกอย่างที่เกี่ยวกับเวลาถูกแทนที่ด้วยของปลอมที่เราสั่งเดินเองได้ เพราะ:
//   - requestAnimationFrame: ต้องนับได้ว่ามี loop กี่ชุดเดินอยู่พร้อมกัน
//   - setTimeout: เกมใช้หน่วงก่อนไปข้อถัดไป ถ้าปล่อยให้ทำงานทันทีจะอ่านผลไม่ทัน
//   - Date.now: เกมล็อกปุ่ม 220ms กันเด็กกดรัว แต่คลิกในเทสเกิดในมิลลิวินาที
//     เดียวกันหมด ถ้าไม่เดินนาฬิกาให้ ทุกคลิกหลังคลิกแรกจะถูกกลืนหาย

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function gamePath(file) {
  return path.join(root, "games", file);
}

export function readGame(file) {
  return readFileSync(gamePath(file), "utf8");
}

export async function loadGame(file, { html } = {}) {
  const source = html ?? readGame(file);

  const frames = new Map();
  let nextFrameId = 1;
  let frameTime = 0;

  const timers = [];
  let clock = 1e9;

  const dom = new JSDOM(source, {
    runScripts: "dangerously",
    url: "http://localhost/",
    beforeParse(window) {
      window.speechSynthesis = { cancel() {}, speak() {} };
      window.SpeechSynthesisUtterance = function () {};
      window.HTMLElement.prototype.setPointerCapture = function () {};
      window.HTMLElement.prototype.releasePointerCapture = function () {};
      if (!window.navigator.mediaDevices) {
        window.navigator.mediaDevices = {
          getUserMedia: () => Promise.reject(new Error("ไม่มีกล้องในเทส")),
        };
      }

      window.requestAnimationFrame = (cb) => {
        const id = nextFrameId++;
        frames.set(id, cb);
        return id;
      };
      window.cancelAnimationFrame = (id) => frames.delete(id);

      window.setTimeout = (fn) => {
        timers.push(fn);
        return timers.length;
      };

      window.Date.now = () => (clock += 250);
    },
  });

  await new Promise((resolve) => dom.window.addEventListener("load", resolve));

  const { window } = dom;

  return {
    window,
    document: window.document,
    $: (selector) => window.document.querySelector(selector),
    $$: (selector) => [...window.document.querySelectorAll(selector)],

    // เดินไปหนึ่งเฟรม แล้วบอกว่ามี callback กี่ตัวที่รออยู่ในเฟรมนั้น
    // หนึ่ง loop ที่ทำงานถูกต้อง = 1 callback ต่อเฟรมเสมอ
    stepFrame() {
      frameTime += 16;
      const due = [...frames.values()];
      frames.clear();
      for (const cb of due) cb(frameTime);
      return due.length;
    },

    stepFrames(count) {
      const counts = [];
      for (let i = 0; i < count; i++) counts.push(this.stepFrame());
      return counts;
    },

    // ปล่อยให้ setTimeout ที่ค้างอยู่ทำงาน (รวมถึงตัวที่ถูกตั้งใหม่ระหว่างทาง)
    flushTimers(rounds = 40) {
      for (let i = 0; i < rounds && timers.length; i++) {
        const batch = timers.splice(0, timers.length);
        for (const fn of batch) fn();
      }
    },

    pressKey(el, key) {
      el.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    },
  };
}
