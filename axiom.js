// axiom.js
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const Pino = require("pino");
const readline = require("readline");
const fs = require("fs");

// IMPORT COMMAND HANDLER
const commandHandler = require("./database/command");

// GLOBAL STATE
let startTime = Date.now();
let msgCount = 0;
let errCount = 0;
let logs = [];             // 4 log terakhir panel
let consoleLogLast = "";   // log konsol terakhir
let lastCPU = 0;
let reconnecting = false;
global.axiom = null;

// CPU USAGE LIGHT
let lastCPUTime = process.cpuUsage();
setInterval(() => {
  const now = process.cpuUsage();
  lastCPU = ((now.user - lastCPUTime.user + now.system - lastCPUTime.system) / 1000).toFixed(1);
  lastCPUTime = now;
}, 1000);

// HELPERS PANEL
function formatUptime(ms) {
  let s = Math.floor(ms / 1000);
  let m = Math.floor(s / 60);
  let h = Math.floor(m / 60);
  s %= 60;
  m %= 60;
  return `${h}h ${m}m ${s}s`;
}
function getRam() { return (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + " MB"; }
function green(t) { return `\x1b[32m${t}\x1b[0m`; }
function red(t) { return `\x1b[31m${t}\x1b[0m`; }
function yellow(t) { return `\x1b[33m${t}\x1b[0m`; }

// LOGGING
function logLast(msg) {
  logs.push(msg);
  if (logs.length > 4) logs.shift();

  consoleLogLast = msg;
  console.log(msg);
}

// PANEL
function panel(status, device, ping = "-", showSource = false) {
  console.clear();
  console.log(`
┌─────────────────────────────────────────────┐
│          ${green("WHATSAPP BOT PANEL ULTRA")}        │
├─────────────────────────────────────────────┤
│ Status : ${status}
│ Device : ${device}
│ Uptime : ${formatUptime(Date.now() - startTime)}
│ CPU    : ${lastCPU} ms
│ RAM    : ${getRam()}
│ Ping   : ${ping}
│ Msg In : ${msgCount}
│ Errors : ${errCount}
├─────────────────────────────────────────────┤
│ Menu Interaktif:
│ 1) Restart Bot
│ 2) Refresh/Clear Panel
│ 3) Tampilkan QR Lagi
│ 4) Keluar/Log out
│ 5) About / Source
├─────────────────────────────────────────────┤
│ Log Terakhir Panel:
│ ${logs.map(l => yellow(l)).join("\n│ ")}
├─────────────────────────────────────────────┤
│ Log Konsol Terakhir:
│ ${yellow(consoleLogLast)}
${showSource ? `
├─────────────────────────────────────────────┤
│ ${green("Source & Credits")}
│ Author       : Rangga
│ Script Writer: ChatGPT
│ Designer     : Rangga & ChatGPT
│ Versi Bot    : Ultra Low RAM v2.0
` : ""}
└─────────────────────────────────────────────┘
`);
}

// TERMINAL MENU
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function setupMenu(axiom) {
  rl.removeAllListeners("line");
  rl.on("line", async (input) => {
    switch (input.trim()) {
      case "1":
        console.log(red("\n→ Restarting bot...\n"));
        restartBot();
        break;
      case "2":
        panel("Terhubung ✓", axiom?.user?.id?.split(":")[0] || "-");
        break;
      case "3":
        if (global.lastQR) qrcode.generate(global.lastQR, { small: true });
        else console.log(red("Tidak ada QR."));
        break;
      case "4":
        console.log(red("→ Keluar bot"));
        process.exit(0);
        break;
      case "5":
        panel("Terhubung ✓", axiom?.user?.id?.split(":")[0] || "-", "-", true);
        break;
      default:
        console.log(yellow("Perintah tidak dikenal."));
    }
  });
}

// INTERNAL RESTART
function restartBot() {
  startTime = Date.now();
  msgCount = 0;
  errCount = 0;
  logs = [];
  consoleLogLast = "";
  reconnecting = false;

  delete require.cache[require.resolve("./axiom.js")];

  process.removeAllListeners("uncaughtException");
  process.removeAllListeners("unhandledRejection");

  startBot();
}

// START BOT
async function startBot() {
  try {
    if (global.axiom) {
      try { global.axiom.end?.(); } catch {}
      try { global.axiom.ws?.close?.(); } catch {}
    }

    const { state, saveCreds } = await useMultiFileAuthState("./axiomSesi");
    const { version } = await fetchLatestBaileysVersion();

    const axiom = makeWASocket({
      version,
      auth: state,
      logger: Pino({ level: "silent" }),
    });

    global.axiom = axiom;
    setupMenu(axiom);
    panel("Menunggu QR...", "Belum Login");

    axiom.ev.on("connection.update", async (update) => {
      const { qr, connection, lastDisconnect } = update;

      if (qr) {
        global.lastQR = qr;
        panel("Scan QR!", "Belum Login");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "open") {
        reconnecting = false;
        panel(green("Terhubung ✓"), axiom.user.id.split(":")[0]);
      }

      if (connection === "close") {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === 401) {
          panel(red("Session Invalid! Menghapus auth..."), "Reset");
          try { fs.rmSync("./auth", { recursive: true, force: true }); } catch {}
          console.log(red("\n→ Session dihapus. Scan QR lagi.\n"));
          return restartBot();
        }

        if (!reconnecting) {
          reconnecting = true;
          panel(red("Terputus, reconnect..."), "Reconnect");
          setTimeout(() => startBot(), 2500);
        }
      }
    });

    axiom.ev.on("creds.update", saveCreds);

    // PESAN MASUK → COMMAND HANDLER
    axiom.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message) return;

      if (!msg.key.fromMe) msgCount++;

      const fromJid = msg.key.remoteJid;
      let senderNum;

      if (msg.key.fromMe) {
        senderNum = "BOT";
      } else if (fromJid.endsWith("@g.us")) {
        // Grup → pakai participant
        senderNum = msg.key.participant?.split("@")[0] || fromJid.split("@")[0];
      } else {
        // Private chat → tampil nomor WA user
        senderNum = msg.key.participant
          ? msg.key.participant.split("@")[0]
          : fromJid.split("@")[0];
      }

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      logLast(`${senderNum} → ${text}`);
      panel("Terhubung ✓", axiom.user.id.split(":")[0]);

      try {
        await commandHandler(axiom, msg, fromJid, text); // tetap pakai JID lengkap
      } catch (e) {
        errCount++;
        logLast(red("Command error: " + e.message));
        panel(red("Error!"), "Running");
      }
    });

    // ANTI CRASH
    process.on("uncaughtException", (err) => {
      errCount++;
      logLast(red("Error: " + err.message));
      panel(red("Error!"), "Running");
    });
    process.on("unhandledRejection", (err) => {
      errCount++;
      logLast(red("Reject: " + err));
      panel(red("Error!"), "Running");
    });

  } catch (e) {
    console.log(red("Startup Error:"), e);
    setTimeout(startBot, 2000);
  }
}

startBot();

module.exports = {
  logLast
};