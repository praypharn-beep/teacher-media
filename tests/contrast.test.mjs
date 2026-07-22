// ตรวจว่าสีปุ่มอ่านออกจริงตามเกณฑ์ WCAG 2.1 ระดับ AA (4.5:1)
//
// เกมเหล่านี้ถูกฉายบนโปรเจกเตอร์ในห้องเรียน ซึ่งทำให้สีจางลงกว่าบนจอ
// ปุ่มสองตัวเคยใช้ตัวอักษรขาวบนพื้นส้ม/ทอง ได้แค่ 2.4-2.8:1 อ่านแทบไม่ออก
//
// เทสนี้อ่านค่าสีจากไฟล์เกมจริง ไม่ได้ฝังค่าไว้ ถ้าใครแก้สีให้แย่ลงเทสจะจับได้

import assert from "node:assert/strict";
import test from "node:test";

import { readGame } from "./helpers/game-harness.mjs";

function relativeLuminance(hex) {
  const value = parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const NAMED = { white: "#ffffff", black: "#000000" };

function normaliseColour(raw) {
  const value = raw.trim().toLowerCase();
  if (NAMED[value]) return NAMED[value];
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return "#" + [...value.slice(1)].map((c) => c + c).join("");
  }
  return null;
}

// ดึงกฎ CSS ตามชื่อ selector แล้วอ่านค่า property ที่ต้องการ
function readDeclaration(css, selector, property) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, "m").exec(css);
  if (!rule) return null;
  const declaration = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i").exec(rule[1]);
  return declaration ? declaration[1].trim() : null;
}

const CASES = [
  {
    name: "ปุ่มทอง ผลักแรง (ภารกิจกู้ของเล่น)",
    file: "J1784395741990.html",
    selector: ".btn.yellow",
    fallbackSelector: ".btn",
  },
  {
    name: "ปุ่มตัวเลือกที่ถูกเลือก (โรงงานแบ่งของ)",
    file: "J1784413532215.html",
    selector: ".btn.warn",
    fallbackSelector: ".btn",
  },
];

for (const testCase of CASES) {
  test(`${testCase.name} ต้องผ่านเกณฑ์ contrast 4.5:1`, () => {
    const css = readGame(testCase.file);

    const background = readDeclaration(css, testCase.selector, "background");
    assert.ok(
      background,
      `หากฎ ${testCase.selector} ใน ${testCase.file} ไม่เจอ — ถ้าเปลี่ยนชื่อคลาสต้องแก้เทสนี้ด้วย`,
    );

    // สีตัวอักษรอาจกำหนดที่กฎนี้เอง หรือสืบทอดมาจาก .btn
    const foregroundRaw =
      readDeclaration(css, testCase.selector, "color") ??
      readDeclaration(css, testCase.fallbackSelector, "color");
    assert.ok(foregroundRaw, `หาสีตัวอักษรของ ${testCase.selector} ไม่เจอ`);

    const foreground = normaliseColour(foregroundRaw);
    const backgroundHex = normaliseColour(background);
    assert.ok(
      foreground && backgroundHex,
      `อ่านค่าสีไม่ออก (ตัวอักษร: ${foregroundRaw}, พื้น: ${background}) — ` +
        `ถ้าเปลี่ยนไปใช้ตัวแปร CSS ต้องปรับเทสนี้`,
    );

    const ratio = contrastRatio(foreground, backgroundHex);
    assert.ok(
      ratio >= 4.5,
      `${testCase.name}: ได้ ${ratio.toFixed(2)}:1 (${foreground} บน ${backgroundHex}) ` +
        `ต่ำกว่าเกณฑ์ 4.5:1 เด็กจะอ่านไม่ออกเวลาฉายโปรเจกเตอร์`,
    );
  });
}
