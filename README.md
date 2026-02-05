# AxiomBot
# WhatsApp Bot Panel Pro  
Dibuat oleh **Rangga** — Script Writer & System Designer: **ChatGPT**

Bot WhatsApp ini dibangun menggunakan **@whiskeysockets/baileys**, dilengkapi panel interaktif di Terminal, stabil, ringan, dan mudah dikembangkan.

---

## 🚀 Fitur Utama
- Panel monitoring real-time:
  - Status koneksi  
  - Uptime  
  - CPU usage  
  - RAM usage  
  - Ping  
  - Hitung pesan masuk  
  - Error counter
- Sistem menu interaktif:
  - Restart bot  
  - Refresh panel  
  - Tampilkan QR  
  - Logout  
  - Info Source/SC  
- Auto reconnect stabil  
- Anti-crash handler  
- Ping: mengukur latensi WhatsApp  
- Struktur kode rapi & aman  
- Konsumsi RAM sangat kecil (±70MB idle)

---

## 📦 Instalasi (Termux / Linux)
Jalankan perintah berikut dari 0:

```bash
pkg update && pkg upgrade -y
pkg install -y git curl wget nano nodejs python unzip zip
```

Clone repository:

```bash
https://github.com/Hjkku/AxiomBot
cd botwa
```

Install dependencies:

```bash
npm install
```

Jalankan bot:

```bash
npm start
```

---

## 🗂 Struktur Folder

```
botwa/
│── index.js
│── package.json
│── README.md
│── LICENSE
└── .gitignore
```

Folder **auth/** otomatis dibuat setelah login.

---

## 🧠 Kustomisasi
Anda dapat menambah command baru di bagian:

```js
sock.ev.on("messages.upsert", async ({ messages }) => {
```

Contoh command:

```js
if (text === "menu") {
    await sock.sendMessage(from, { text: "Halo, ini menu bot!" })
}
```

---

## 💻 Dibuat Dengan
- Node.js
- Baileys
- Pino
- qrcode-terminal

---

## 👑 Author
- **Rangga** — Developer
- **ChatGPT** — Script Writer & Designer

---

## 📜 License
Proyek ini dirilis di bawah lisensi MIT.  
Lihat file **LICENSE** untuk detail lebih lanjut.

---

## ⭐ Dukungan
Silakan ⭐ repo ini jika membantu!
