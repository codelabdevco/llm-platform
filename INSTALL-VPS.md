# 🚀 คู่มือติดตั้ง LLM Platform บน Hostinger VPS

## ขั้นตอนที่ 1: เข้า VPS ผ่าน SSH

```bash
ssh root@kul.hostingervps.com
```

หรือใช้ Web Terminal ของ Hostinger (ผ่าน Browser Terminal ที่ port 2745)

---

## ขั้นตอนที่ 2: อัพโหลดโปรเจคไป VPS

**วิธี A — ใช้ SCP (จากเครื่องคุณ)**
```bash
scp -r ./llm-platform root@kul.hostingervps.com:/opt/llm-platform
```

**วิธี B — ใช้ Git**
```bash
# ถ้าโปรเจคอยู่บน Git repo
cd /opt
git clone <your-repo-url> llm-platform
```

**วิธี C — ใช้ SFTP ผ่าน Hostinger File Manager**
อัพโหลดโฟลเดอร์ `llm-platform` ไปที่ `/opt/llm-platform`

---

## ขั้นตอนที่ 3: รัน Deploy Script

```bash
cd /opt/llm-platform
chmod +x deploy.sh
./deploy.sh
```

สคริปต์จะติดตั้ง Docker, Docker Compose, และเตรียมทุกอย่างให้อัตโนมัติ

---

## ขั้นตอนที่ 4: แก้ไข .env

```bash
# คัดลอก .env.production เป็น .env
cp .env.production .env

# แก้ไข
nano .env
```

**สิ่งที่ต้องแก้:**
1. `ANTHROPIC_API_KEY` — ใส่ API Key ของ Claude
2. `ADMIN_PASSWORD` — เปลี่ยนรหัสผ่าน Admin
3. `ADMIN_EMAIL` — ตั้งค่าเป็น admin@codelabdev.co (ตั้งไว้ให้แล้ว)

---

## ขั้นตอนที่ 5: Build & Start

```bash
cd /opt/llm-platform
docker compose up -d --build
```

รอประมาณ 2-5 นาทีให้ build เสร็จ

**ดู logs:**
```bash
docker compose logs -f
```

**ดูสถานะ containers:**
```bash
docker compose ps
```

---

## ขั้นตอนที่ 6: เข้าใช้งาน

เปิด browser ไปที่: **http://kul.hostingervps.com**

ล็อกอินด้วย:
- Email: `admin@codelabdev.co`
- Password: (ที่ตั้งไว้ใน .env)

---

## คำสั่งที่มีประโยชน์

```bash
# หยุด
docker compose down

# รีสตาร์ท
docker compose restart

# ดู logs backend
docker compose logs -f backend

# ดู logs frontend
docker compose logs -f frontend

# อัพเดทโค้ดแล้ว rebuild
docker compose up -d --build

# ดู disk usage
docker system df
```

---

## ⚠️ Troubleshooting

### Port 80 ถูกใช้แล้ว
```bash
# ดูว่าอะไรใช้ port 80
lsof -i :80
# หรือ
ss -tlnp | grep :80

# หยุด service ที่ใช้ port 80 (เช่น Apache)
systemctl stop apache2
systemctl disable apache2
```

### Docker build ช้า / หน่วยความจำไม่พอ
```bash
# เพิ่ม swap
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### MongoDB ไม่ start
```bash
docker compose logs mongo
# ถ้า permission error:
chmod 777 -R /var/lib/docker/volumes/
```
