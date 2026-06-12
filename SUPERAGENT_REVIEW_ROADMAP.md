# Superagent — รายงานตรวจงาน + Roadmap พัฒนา

Minecraft Education 1.21.133 | ตรวจเมื่อ 2026-06-11

---

## 1. ผลตรวจงานที่ Codex ทำ

**สถานะ:** ใช้งานได้ โครงสร้างถูกหลัก เทสต์ผ่าน 17/17 และแพ็ก `.mcaddon` ได้ (27 ไฟล์)

### จุดที่ทำได้ดี
- โครงสร้าง BP + RP ครบ ผูก UUID dependency กันสองทางถูกต้อง
- Entity เป็นตัวละครก้อนเดียว 1×1×1 อมตะ: health 2048, `damage_sensor` ปิด, `persistent`, ไม่มี gravity/collision/pushable, fire immune
- Particle อ้างอิง atlas ของ vanilla (`textures/particle/particles`) จึงไม่มี texture หาย
- บล็อก MakeCode ครอบคลุม: spawn / recall / follow / move / dash / scout / patrol / orbit / evade / high ground / zigzag / spiral / smart move / attack aura / guard / power burst / overdrive
- BP script มีการกันตัวซ้ำ, debuff ตามระดับภัยคุกคาม, fallback particle

### ปัญหา/ความเสี่ยง (เรียงตามความสำคัญ)

| # | ปัญหา | ไฟล์ | ผลกระทบ | แนวทางแก้ |
|---|-------|------|---------|-----------|
| 1 | `isAgent()` เช็ค `typeId.indexOf("agent")>=0` ซึ่งจับ `superagent:superagent` ด้วย | `superagent_BP/scripts/main.js` | ตัวละครถูกมองเป็น Agent เอง logic เพี้ยน | เช็ค typeId ให้ตรงตัว + exclude `SUPER_AGENT_ID` |
| 2 | BP auto-spawn + ลบตัวซ้ำในรัศมี 128 รอบผู้เล่นทุก 2 tick ตีกับ MakeCode ที่ teleport ตัวละครไปที่อื่น | `main.js` `ensureFallbackSuperagent` / `superagent.ts` | Race: ตัวที่ MakeCode คุมอาจถูกดึงกลับ/ลบ | กำหนดเจ้าของตำแหน่งชัดเจน หรือใช้ owner tag ผูกตัวกับ player คนเดียว |
| 3 | Auto-combat AOE (dmg 14, r8) เปิดตลอดทุก 2 tick ไม่ขึ้นกับโค้ดเด็ก | `main.js` `attackAround` | เกมง่ายเกิน + ผลไม่ได้มาจากโปรแกรมของผู้เรียน | ให้โจมตีเมื่อเรียกบล็อกเท่านั้น + สวิตช์เปิด/ปิดของครู |
| 4 | `@minecraft/server` ระบุ `2.4.0` — ต้องยืนยันว่าตรงกับ API ใน 1.21.133 | `superagent_BP/manifest.json` | ถ้าไม่ตรง script module โหลดไม่ขึ้น | ตรวจเทียบเวอร์ชันจริงในเกม / บัมพ์ `min_engine_version` เป็น `[1,21,130]` |
| 5 | `agent-survival.ts` (1137 บรรทัด) ไม่อยู่ใน `pxt.json` files | root | โค้ดค้าง สับสน | ลบหรือย้ายไป `archive/` |
| 6 | ยังไม่มี story ของ Python ชัดเจน | — | — | ออกแบบ namespace/ชื่อบล็อกให้โค้ด Python ที่ transpile ออกมาอ่านรู้เรื่อง |

> หมายเหตุ: error ตอนรัน `package-superagent-addon.js` เกิดจาก sandbox ลบไฟล์เดิมบน mount ไม่ได้ (EPERM) ไม่ใช่บั๊กโค้ด

---

## 2. Roadmap: ทำให้ "เหนือกว่า Agent ปกติ"

จุดอ่อนของ Agent เดิม = เดิน/teleport ตามคำสั่งตรง ๆ ไม่มี "การรับรู้" เขียน algorithm จริงได้น้อย
ทิศทางคือเพิ่ม **การรับรู้ (sensing)** + **เหตุการณ์ (events)** + **หน่วยความจำ (state)** ให้ผู้เรียนเขียนตรรกะจริง

### Phase 1 — แก้ฐานให้นิ่ง (1–2 วัน)
- แก้ปัญหา #1–#5 ข้างบน โดยเฉพาะเลิก auto-combat → ย้ายเป็นบล็อกที่ต้องเรียก
- กำหนดเจ้าของตัวละคร 1 ตัว/ผู้เล่น ด้วย owner tag เลิกระบบ "ตัวสำรอง" ที่ตีกับ MakeCode
- เพิ่มบล็อก `superagent set name` ให้ nameTag โชว์สถานะงานปัจจุบัน

### Phase 2 — Sensing (หัวใจที่ทำให้ "ฉลาดกว่า Agent")
บล็อกที่คืนค่าให้เอาไปใช้กับ if/loop ได้จริง:
- `superagent detect block ahead` → คืน block id
- `superagent nearest mob` / `nearest hostile` → คืนตำแหน่งหรือระยะ
- `superagent count mobs in radius (r)` → คืนจำนวน
- `superagent scan area (w,h,d) for (block)` → คืน list ตำแหน่ง
- `superagent can move (direction)?` → boolean เช็คสิ่งกีดขวาง
ใช้ `dimension.getEntities` / `dimension.getBlock` ใน BP แล้ว expose ผ่าน scriptEvent หรือ dynamic property

### Phase 3 — Events (event-driven programming)
- `on superagent arrive`, `on superagent detect mob`, `on superagent block changed`
- ผูกกับ `world.afterEvents` + custom dispatch → ผู้เรียนเขียนแบบ reactive ได้

### Phase 4 — Navigation จริง (เดินแทน teleport)
- เพิ่ม `minecraft:navigation.walk` + `minecraft:movement` + behavior goals ให้ตัวละคร "เดิน" ไปหาเป้าจริง
- บล็อก `superagent walk to (x,y,z)` / `walk to nearest (mob)` → ดูเป็นธรรมชาติกว่า teleport มาก

### Phase 5 — งานสร้าง/ทำเหมืองอัจฉริยะ (เก่งกว่า Agent)
- `superagent build shape from list` (สร้างจาก array ของ offset+block) → สอน data structure
- `superagent fill area`, `superagent mine vein` (ขุดตามสายแร่อัตโนมัติ)
- `superagent follow blueprint` อ่าน pattern แล้วสร้างตาม

### Phase 6 — หน่วยความจำ & หลายตัว
- ใช้ `entity.setDynamicProperty` เก็บ state ข้ามเซสชัน (HP, โหมด, จุดบ้าน)
- รองรับหลายตัวมีชื่อ (squad) ให้เด็กเขียนทีมหุ่นยนต์
- โหมดที่ผู้เรียน "เขียนเอง": patrol / mine / farm / defend

### Phase 7 — ความสมจริง & ครูควบคุม
- Animation controller: idle ลอยเด้ง, ท่าโจมตี, เปลี่ยนสีตามโหมด
- บล็อก `superagent say (text)` พูดผ่าน nameTag/title
- Teacher toggle: เปิด/ปิด combat, จำกัด damage สำหรับห้องเรียน

---

## 3. หมายเหตุเรื่อง Python
Minecraft Education Code Builder transpile บล็อกจาก `.ts` extension เป็น Python ให้อัตโนมัติ
→ extension เดียวรองรับทั้ง MakeCode block และ Python อยู่แล้ว
สิ่งที่ต้องทำคือออกแบบชื่อ namespace/ฟังก์ชันให้โค้ด Python ที่ออกมาอ่านง่าย เช่น
`superagent.walk_to(x, y, z)`, `superagent.nearest_hostile()` — ไม่ต้องเขียน Python runtime แยก
