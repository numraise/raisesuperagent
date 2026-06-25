# superagent — Roadmap Phase 7+

อัปเดต 2026-06-11 | ฐาน: v0.1.23 (Phase 1–11 เสร็จ, 50 unit tests ผ่าน)

> สถานะ: ✅ เสร็จ · 🚧 กำลังทำ (Phase 7) · 🔜 backlog
> ความยาก: 🟢 เร็ว · 🟡 กลาง · 🔴 งานใหญ่

---

## สรุปของที่ทำแล้ว (Phase 1–6)

| เฟส | ความสามารถ |
|---|---|
| 1 | แก้บั๊ก isAgent, owner-scoped 1 ตัว/คน, combat toggle, label |
| 2 | sensing คืนค่า (testfor/testforblock/agent.detect) |
| 3 | events edge-triggered (on hostile/clear/blocked) |
| 4 | navigation เดินลื่น (glide + walk to/follow/reached) |
| 5 | build (fill/setblock/pattern) + mine (Agent native) |
| 6 | memory ข้ามเซสชัน (scoreboard) + home + squad guards |

ข้อสมมติฐานสำคัญ: **นักเรียนเป็น Operator** จึงรันคำสั่ง (testfor, fill, scoreboard, title, scriptevent) ได้

---

## Phase 7 — กลุ่มคุ้มค่า/ความเสี่ยงต่ำ 🚧 (กำลังทำ)

ขยายบนของเดิม ไม่กระทบสถาปัตยกรรม

1. 🟡 **find nearest block/ore** — `nearestBlockDistance(block, max)` → number, `nearestBlockDirection(block, max)` → ทิศ (0–5, -1=ไม่เจอ) สแกนตามแกนด้วย `testforblock`. สอน: search, if/loop
2. 🟡 **shape library** — `buildPyramid`, `buildStaircase`, `buildCircle` (Bresenham), `buildDisc` (sqrt). สอน: เรขาคณิต, อัลกอริทึม
3. 🟢 **auto-status** — nameTag + อนุภาคเปลี่ยนตามสถานะ (idle/moving/guard) คำนวณใน BP. ช่วย debug
4. 🟡 **mission / leaderboard** — `missionStart` (title), `missionAward` (score++), `missionScore`, `missionComplete`, `showScoreboard` (sidebar). ใช้ scoreboard ข้ามเซสชัน. สอน: goal-driven coding, state

---

## Phase 8 — ทักษะงานของ Agent + ควบคุมของครู ✅ (เสร็จ v0.1.20)

- ✅ **inventory awareness** — `inventoryCount(slot)`, `hasItems(slot, amount)`
- ✅ **fetch & deliver** — `dropItems(direction)`, `collectItems()`
- ✅ **auto-bridge / auto-stair** — `bridgeForward(steps)`, `stairUp(steps)` (ต้อง equip บล็อกใน Agent ก่อน)
- ✅ **teacher controls** — `freezeAll`/`unfreezeAll` (หยุด/ปล่อยการเคลื่อนที่ทั้งหมด), `gatherAll` (รวมตัวละครมาหาครู), `resetSquad` (ไล่ guard + ล้างเป้า/label/home)

---

## Phase 9 — A* pathfinding ✅ (เสร็จ v0.1.21)

- ✅ **A\* pathfinding** — `pathTo(x,y,z)` เดินอ้อมสิ่งกีดขวาง
  - โมดูล pure `pathfind.js` (A* 6-neighbor, bounded 300 nodes/24 บล็อก) unit test ได้
  - BP สร้าง `isBlocked` จาก `dimension.getBlock` (solid = ไม่ใช่ air/liquid), เก็บ waypoints เป็น JSON ใน dynamic property แล้ว glide ตามทีละจุด
  - ไม่เจอเส้นทาง → fallback เป็น glide ตรง
  - *หมายเหตุ:* ตัวละครบินได้ (no gravity) จึง A* แบบ 3 มิติในอากาศ ไม่ต้องจัดการ jump/step-up; ยังไม่ recompute ระหว่างทางถ้าโลกเปลี่ยน

---

## Phase 10 — Advanced Build & Copy ✅ (เสร็จ v0.1.22)

- ✅ **3D blueprint จาก array** — `buildLayer(block, rows)` (2D), `buildBlueprint(block, rows)` (3D ใช้แถว `-` ขึ้นชั้นใหม่) สอน nested array/string
- ✅ **copy & paste (clone)** — `copyRegion(...)` จำ 2 มุม, `pasteHere()` = `/clone ... ~ ~ ~`
- ✅ **fill replace** — `replaceArea(from, to, w, h, d)` = `/fill ... replace`

---

## Phase 11 — Build transforms + adaptive pathfinding ✅ (เสร็จ v0.1.23)

- ✅ **mirror / rotate blueprint** — `buildLayerTransformed(block, rows, transform)` (none / mirror X / mirror Z / rotate 180)
- ✅ **A\* recompute กลางทาง** — เก็บ goal ไว้, ถ้า waypoint ถัดไปโดนบล็อก (โลกเปลี่ยน) จะคำนวณเส้นทางใหม่อัตโนมัติ

---

## Phase 12 — Collision-aware grid move ✅ (เสร็จ v0.1.33)

- ✅ บล็อก `move`/`dash`/`scout`/`patrol`/`zigzag`/`spiral` เดินทีละบล็อกผ่าน BP (`superagent:step`) เช็ค collision ด้วย `getBlock` → **ชนกำแพงแล้วหยุด ไม่ทะลุ**
- ✅ `ensureCharacter` เลิก force-teleport (ไม่ override การเดินที่มี collision แล้ว)

> หมายเหตุ in-game (v0.1.27–0.1.33): แก้ปัญหาใหญ่ที่เจอตอนเทสต์จริง — `@minecraft/server` 2.4.0 → 1.17.0, รวมเป็นไฟล์เดียว, ลบ `beforeEvents.entityHurt` ที่ไม่มีใน API, ตัด particle ไอเดิล, dedup เหลือตัวเดียว/ผู้เล่น, combat delegate ไป BP

---

## Phase 13+ — backlog (เลือกทำต่อ)

### AI ฉลาดขึ้น
- 🟡 **A\* ขยายเพิ่ม** — เป้าไกลเกิน range (chunked/partial path), เดินไต่พื้นแบบมี gravity
- 🟢 **threat memory / aggro** — จำว่าใครตีล่าสุดแล้วไล่ก่อน (dynamic property)

### ทำงานอัตโนมัติ (survival)
- 🟡 **auto-farm** — ไถ/ปลูก/เก็บเกี่ยว (`agent.till`/`place`/`collect`) *ตรวจชื่อ API ก่อน*

### ห้องเรียน / multiplayer
- 🔴 **squad สั่งทีละตัว** — ตั้งชื่อสมาชิก + เลือกตัว active (ต้องรื้อ movement ให้ track หลายตำแหน่ง)

> ⚠️ ยังไม่เคยทดสอบในเกมจริงสักเฟส — ดู `END_TO_END_TEST_PLAN.md`

### โพลิช
- 🟢 **sound + animation** — playsound ตอนอีเวนต์ + animation controller (idle bob/attack lunge)
- 🟡 **energy system** — พลังงานลด/เติม (memory ล้วน) สอน state

### เครื่องมือ
- 🟢 **Python lesson templates** — ชุดตัวอย่างโค้ดสำเร็จรูป
- 🟡 **path record & replay** — บันทึก/เล่นซ้ำเส้นทาง (array/loop)
- 🔴 **mini-games** — maze solver / tower defense / capture-the-flag (รวมทุกเฟส)

---

## หมายเหตุการยืนยัน runtime
ทุกเฟสผ่าน unit test (ตรรกะ + command strings) แต่ยังต้องทดสอบในเกม 1.21.133 จริง:
block id, syntax ของ execute/title/scoreboard, entity API (teleport facing, dynamic property), และ permission ของ operator. แนะนำทำ end-to-end ด้วย Minecraft Education + เปิด cheats หลังจบแต่ละกลุ่ม
