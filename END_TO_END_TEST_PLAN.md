# superagent — แผนทดสอบ End-to-End ในเกมจริง

เวอร์ชัน v0.1.37 | Minecraft Education 1.21.133 | ใช้กับเครื่องที่ติดตั้ง MC Education

> unit tests 54 เคสครอบคลุม "ตรรกะ + command string" แล้ว เอกสารนี้คือสิ่งที่ test มองไม่เห็น:
> พฤติกรรม runtime จริง (block id, syntax คำสั่ง, entity API, permission)

---

## 0. เตรียมก่อนเริ่ม

1. เปิด Minecraft Education → **Play → Create New → New** (หรือใช้ Flat world)
2. ตั้งค่าโลก: **Cheats = ON**, **Default Game Mode = Survival**, **Player Permissions = Operator** (สำคัญ! บล็อกหลายตัวต้องใช้สิทธิ์ operator)
3. **Behavior/Resource Packs**: ดับเบิลคลิก `dist/superagent-0.1.37.mcaddon` เพื่อ import → ในหน้าตั้งค่าโลก เปิดใช้ทั้ง **superagent Behavior** และ **superagent Resources**
4. เข้าโลก แล้วยืนยันใน chat ว่าขึ้นข้อความ `superagent 0.1.37 script active` (= BP script ทำงาน)

### โหลด MakeCode extension (เลือกวิธีใดวิธีหนึ่ง)

- **วิธี A (GitHub):** ใช้ `https://github.com/numraise/raisesuperagent` → ใน Code Builder → MakeCode → Extensions → วาง URL
- **วิธี B (paste):** สร้างโปรเจกต์ MakeCode ใหม่ → สลับเป็น JavaScript → วางเนื้อหา `superagent.ts` ทั้งไฟล์ → กลับมาโหมด Blocks

---

## 1. Addon / BP (ทดสอบได้โดยไม่ต้องมี extension)

| # | ทำ | คาดหวัง | ผ่าน? |
|---|-----|---------|------|
| 1.1 | เข้าโลก มองหาตัวละคร superagent ใกล้ตัว | มีคิวบ์ 1×1×1 ชื่อ `superagent [idle]` ลอยอยู่ | ☑ 2026-06-12 |
| 1.2 | ตีตัวละครด้วยดาบ/ระเบิด TNT ข้าง ๆ | ตัวละครไม่ตาย ไม่เลือดลด (damage ถูกยกเลิก) | ☐ |
| 1.3 | พิมพ์ `/scriptevent superagent:combat on` แล้วล่อ zombie เข้ามา | ตัวละครโจมตี zombie อัตโนมัติ มีอนุภาคไฟ + ป้ายเปลี่ยนเป็น `[guard]` | ☐ |
| 1.4 | `/scriptevent superagent:combat off` | หยุดโจมตีอัตโนมัติ | ☐ |
| 1.5 | `/scriptevent superagent:label Scout` | ป้ายเหนือหัวเปลี่ยนเป็น `Scout` | ☑ 2026-06-12 (`E2E-034`) |
| 1.6 | `/scriptevent superagent:freeze on` แล้วลองให้มันเดิน | ตัวละครหยุดนิ่ง · `freeze off` แล้วขยับได้อีก | ☐ |
| 1.7 | `/scriptevent superagent:burst` | BP handler ตอบกลับและไม่ error | ☑ 2026-06-12 (`hit 0 mob(s)`) |
| 1.8 | `/scriptevent superagent:burst` ใกล้ม็อบ hostile | hit count มากกว่า 0 และ combat path ทำ damage ได้จริง | ☑ 2026-06-12 (user verified hit > 0) |
| 1.9 | v0.1.35 `/scriptevent superagent:label TEST-035` | ป้ายเหนือหัวเปลี่ยนเป็น `TEST-035` | ☑ 2026-06-13 |
| 1.10 | v0.1.35 `/scriptevent superagent:burst` | ยังโจมตีได้ แต่ไม่พิมพ์ debug `hit N mob(s)` | ☑ 2026-06-13 |

> ถ้า 1.1 ไม่เห็นตัวละคร: เช็คว่าเปิด Resource pack แล้ว และ texture โหลด — ถ้าเห็นแต่กล่องไม่มี texture = ปัญหา RP/geometry
> รอบ smoke test 2026-06-12 โลกเดิมมีข้อความ "At least one of your resource or behavior packs failed to load" แต่ยังเห็น `superagent 0.1.34 script active`, label handler และ burst handler ทำงาน จึงควรแยกตรวจ pack อื่นในโลกนั้นถ้าข้อความนี้ยังขึ้น.
> รอบเดียวกัน `/summon zombie ~ ~ ~` ถูกโลกนี้ปฏิเสธด้วย "The summon command is not available in this world." ภายหลังผู้ใช้ยืนยัน `burst` แบบ hit > 0 แล้ว จึงถือว่า combat path หลักผ่าน.
> รอบ smoke test 2026-06-13 ผู้ใช้ยืนยัน v0.1.35 แล้วว่า `/scriptevent superagent:label TEST-035` เปลี่ยนป้ายได้ และ `/scriptevent superagent:burst` ไม่พิมพ์ข้อความ `hit N mob(s)` แล้ว.

---

## 2. Navigation + A* pathfinding (Phase 4 + 9) — จุดเสี่ยงสูงสุด

| # | ทำ | คาดหวัง | ผ่าน? |
|---|-----|---------|------|
| 2.1 | `walk to` พิกัดที่โล่ง (เช่นห่าง 10 บล็อก) | ตัวละคร "ไหล" ลื่นไปหา ไม่กระตุก หันหน้าตามทิศ | ☐ |
| 2.2 | `follow walk on` แล้วเดินไปมา | ตัวละครไหลตามผู้เล่น | ☐ |
| 2.3 | ก่อกำแพงสูง 3 บล็อกกั้นระหว่างตัวละครกับเป้า แล้ว `path to` เป้าฝั่งตรงข้าม | ตัวละคร **เดินอ้อมกำแพง** ไปถึงเป้า (ไม่ทะลุ) | ☐ |
| 2.4 | `path to` เป้าที่ถูกปิดล้อมหมด | fallback เป็นไหลตรง (ไม่ค้าง/ไม่ error) | ☐ |
| 2.5 | สังเกต FPS ตอน path ระยะ ~20 บล็อก | ไม่กระตุกรุนแรง (A* bounded 300 nodes) | ☐ |

> เสี่ยง: `entity.teleport` + `facingLocation`, `dimension.getBlock` คืน `isAir/isLiquid`, dynamic property เก็บ path JSON

---

## 2A. MakeCode extension smoke

| # | ทำ | คาดหวัง | ผ่าน? |
|---|-----|---------|------|
| 2A.1 | เปิด Code Builder / MakeCode ในโลกที่ติดตั้ง v0.1.35 | เห็นหมวด `SUPERAGENT` ใน toolbox | ☑ 2026-06-13 |
| 2A.2 | กด Start ในโปรเจกต์ที่มี `on chat command "run" -> superagent spawn at player` | MakeCode compile/start ผ่านและกลับเข้าเกม | ☑ 2026-06-13 |
| 2A.3 | พิมพ์ chat command `run` | คำสั่ง MakeCode รับ event และเรียก block `spawn at player` โดยไม่ error | ☑ 2026-06-13 |
| 2A.4 | เพิ่ม MakeCode chat commands `nav`/`path`/`stop`/`face`/`sense` แล้วกด Start | MakeCode compile/start ผ่านหลังเพิ่ม Navigation + Sensing blocks | ☑ 2026-06-13 |
| 2A.5 | พิมพ์ `path` จาก chat command ที่เรียก `superagent.pathTo(...)` | superagent เคลื่อนไปตำแหน่งใหม่ในเกมโดยไม่ error | ☑ 2026-06-13 |
| 2A.6 | พิมพ์ `nav`/`stop`/`face`/`sense` | MakeCode รับ event และส่งคำสั่งถึง BP โดยไม่ error; `sense` ยังต้องแยกเคสยืนยันค่าที่แสดงจริง | ◐ 2026-06-13 |

> Smoke นี้ยืนยันว่า extension import/compile/run path ทำงาน และ `pathTo` มีผลเห็นตัว superagent เคลื่อนที่จริง แต่ยังไม่แทนการทดสอบ block กลุ่ม Navigation/Sensing/Build แบบละเอียดด้านล่าง. รอบนี้ `sense` ถูกเรียกจาก MakeCode ได้โดยไม่ error แต่ยังไม่เห็นข้อความ report ชัดเจนบนหน้าจอ จึงต้องทดสอบซ้ำในฉากที่มี mob อยู่ในระยะและจดค่าที่แสดง.

---

## 3. Sensing + Events (Phase 2 + 3)

| # | ทำ | คาดหวัง | ผ่าน? |
|---|-----|---------|------|
| 3.1 | `nearest hostile distance` ขณะมี zombie ใกล้ | คืนค่าระยะที่สมเหตุผล (ไม่ใช่ -1) | ☐ |
| 3.2 | `path clear ahead` ขณะหน้าโล่ง / มีบล็อก | คืน true / false ถูกต้อง (ทดสอบ `testforblock`) | ☐ |
| 3.3 | `nearest stone distance up to 8` ใกล้กองหิน | คืนค่า > 0 | ☐ |
| 3.4 | ตั้ง `on hostile within 6` + `watch on` แล้วล่อ mob | โค้ดในอีเวนต์รันครั้งเดียวตอน mob เข้า (ไม่รันรัว) | ☐ |

> เสี่ยง: boolean ที่ `mobs.execute` คืนจาก `testfor`/`testforblock` — ต้องเป็น operator ถึงได้ค่าถูก

---

## 4. Build + Mine + Blueprint (Phase 5 + 7 + 10)

| # | ทำ | คาดหวัง | ผ่าน? |
|---|-----|---------|------|
| 4.1 | `build box stone 3 3 3` | เกิดกล่องหิน 3×3×3 ที่ตัวละคร | ☐ |
| 4.2 | `build pyramid stone 4` / `build circle stone 5` | พีระมิด/วงกลมถูกต้อง (เช็ค block id ทุกชนิดในเมนู) | ☐ |
| 4.3 | `build blueprint` ตามตัวอย่างบ้าน 2 ชั้น | สร้าง 3 มิติถูกชั้น (`-` ขึ้นชั้น) | ☐ |
| 4.4 | ใส่บล็อกใน Agent → `mine forward 5` | Agent ขุดอุโมงค์ + เก็บของเข้ากระเป๋า | ☐ |
| 4.5 | `copy region` 2 มุม → ไปที่ใหม่ → `paste here` | clone โครงสร้างมาวางถูกตำแหน่ง | ☐ |
| 4.6 | `replace dirt with stone 3 1 3` บนพื้นดิน | ดินกลายเป็นหิน เฉพาะในกล่อง | ☐ |

> เสี่ยง: block id (`oak_planks`, `sandstone`, `glowstone` ฯลฯ), `/fill ... hollow`, `/fill ... replace`, `/clone` syntax ใน 1.21.133

---

## 5. Memory + Squad + Mission (Phase 6 + 7 + 8)

| # | ทำ | คาดหวัง | ผ่าน? |
|---|-----|---------|------|
| 5.1 | `remember ore = 5` → `memory ore = 5` | คืน true (อ่านค่ากลับได้) | ☐ |
| 5.2 | `remember runs = 3` → **ออกจากโลก แล้วเข้าใหม่** → `memory runs = 3` | ยังคืน true (อยู่ข้ามเซสชัน) | ☐ |
| 5.3 | `set home` ที่จุดหนึ่ง → เดินไปไกล → `go home` | ตัวละครไหลกลับจุดบ้าน | ☐ |
| 5.4 | `summon guard` 2 ครั้ง + `combat on` | มี guard 2 ตัววนรอบตัว สู้ mob | ☐ |
| 5.5 | `dismiss guards` | guard หายหมด ตัวหลักยังอยู่ | ☐ |
| 5.6 | `mission start "Test"` + `show scoreboard` + `award 5` | ขึ้น title กลางจอ + scoreboard ข้างจอเพิ่มเป็น 5 | ☐ |

> เสี่ยง: `scoreboard ... add @s`, `execute if score @s ... matches`, `title @s`, `scoreboard objectives setdisplay sidebar`

---

## 6. Multiplayer (ถ้ามีหลายเครื่อง)

| # | ทำ | คาดหวัง | ผ่าน? |
|---|-----|---------|------|
| 6.1 | ผู้เล่น 2 คนยืนใกล้กัน แต่ละคนมีตัวละครของตัวเอง | ตัวละครไม่ถูกลบข้ามกัน (owner tag แยก) | ☐ |
| 6.2 | คนหนึ่ง `gather all` | ตัวละครใกล้ ๆ ถูกเรียกมารวม | ☐ |

---

## วิธีบันทึกผล
ทำเครื่องหมาย ☑ ในช่อง "ผ่าน?" ข้อไหนไม่ผ่านให้จดข้อความ error / พฤติกรรมจริงไว้ แล้วส่งกลับมา ผมจะแก้เป็นรอบ ๆ ตามที่เจอจริง — โดยเฉพาะหมวด 2 (A*) และ block id ในหมวด 4 ที่เสี่ยงสุด
