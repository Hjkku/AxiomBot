// axiom.js
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay } = require("@whiskeysockets/baileys");
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
let logs = [];
let lastCPU = 0;
let reconnecting = false;
global.axiom = null;

// CACHE USER MESSAGE KEY UNTUK ANTI-SPAM
const userMessages = {}; 
const SPAM_LIMIT = 5; 

// CPU USAGE MONITOR
let lastCPUTime = process.cpuUsage();
setInterval(() => {
  const now = process.cpuUsage();
  lastCPU = ((now.user - lastCPUTime.user + now.system - lastCPUTime.system) / 1000).toFixed(1);
  lastCPUTime = now;
}, 1000);

// HELPERS
function formatUptime(ms) {
  let s = Math.floor(ms / 1000);
  let m = Math.floor(s / 60);
  let h = Math.floor(m / 60);
  s %= 60; m %= 60;
  return `${h}h ${m}m ${s}s`;
}
function getRam() { return (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + " MB"; }
function green(t) { return `\x1b[32m${t}\x1b[0m`; }
function red(t) { return `\x1b[31m${t}\x1b[0m`; }
function yellow(t) { return `\x1b[33m${t}\x1b[0m`; }

function logLast(msg) {
  logs.push(msg);
  if (logs.length > 4) logs.shift();
  console.log(msg);
}

function panel(status, device) {
  console.clear();
  console.log(`
┌─────────────────────────────────────────────┐
│          ${green("WHATSAPP BOT PANEL ULTRA")}        │
├─────────────────────────────────────────────┤
│ Status : ${status}
│ Device : ${device}
│ Uptime : ${formatUptime(Date.now() - startTime)}
│ RAM    : ${getRam()} | CPU : ${lastCPU} ms
│ Msg In : ${msgCount} | Errors : ${errCount}
├─────────────────────────────────────────────┤
│ Log Terakhir:
│ ${logs.map(l => yellow(l)).join("\n│ ")}
└─────────────────────────────────────────────┘
`);
}

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("./axiomSesi");
    const { version } = await fetchLatestBaileysVersion();

    const axiom = makeWASocket({
      version,
      auth: state,
      logger: Pino({ level: "silent" }),
      printQRInTerminal: false
    });

    global.axiom = axiom;

    axiom.ev.on("connection.update", async (update) => {
      const { qr, connection, lastDisconnect } = update;
      if (qr) qrcode.generate(qr, { small: true });
      if (connection === "open") {
        reconnecting = false;
        panel(green("Terhubung ✓"), axiom.user.id.split(":")[0]);
      }
      if (connection === "close") {
        if (!reconnecting) {
          reconnecting = true;
          setTimeout(() => startBot(), 3000);
        }
      }
    });

    axiom.ev.on("creds.update", saveCreds);

    axiom.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

      const fromJid = msg.key.remoteJid;
      const senderNum = msg.key.participant || fromJid;
      const isMe = msg.key.fromMe;

      if (!isMe) msgCount++;

      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

      // --- LOGIKA ANTI-LINK & ANTI-SPAM ---
      if (!isMe) {
        if (!userMessages[senderNum]) userMessages[senderNum] = [];
        userMessages[senderNum].push(msg.key);

        const hasLink = /https?:\/\//i.test(text);
        const isSpam = userMessages[senderNum].length > SPAM_LIMIT;

        if (hasLink || isSpam) {
          logLast(red(`!! Membersihkan ${hasLink ? 'Link' : 'Spam'} dari ${senderNum.split('@')[0]}`));

          // 1. HAPUS DARI TAMPILAN BOT (CHAT MODIFY)
          // Ini yang membuat link/spam hilang dari layar WA Bot
          try {
            await axiom.chatModify({
              clear: {
                messages: [{ 
                  id: msg.key.id, 
                  fromMe: false, 
                  timestamp: msg.messageTimestamp 
                }]
              }
            }, fromJid);
          } catch (e) {
            logLast(red("Gagal clear tampilan: " + e.message));
          }

          // 2. ATTEMPT DELETE FOR EVERYONE (Hanya bekerja jika bot admin di grup)
          try {
            await axiom.sendMessage(fromJid, { delete: msg.key });
          } catch {}

          // Bersihkan cache spam user
          userMessages[senderNum] = [];
          return; // Stop agar tidak masuk ke command handler
        }
      }

      logLast(`${senderNum.split('@')[0]} → ${text.substring(0, 15)}...`);
      panel("Terhubung ✓", axiom.user.id.split(":")[0]);

      // JALANKAN COMMAND HANDLER
      try {
        await commandHandler(axiom, msg, fromJid, text);
      } catch (e) {
        errCount++;
        logLast(red("Cmd Error: " + e.message));
      }
    });

    // Reset berkala cache spam setiap 2 menit agar RAM aman
    setInterval(() => {
        for (let user in userMessages) userMessages[user] = [];
    }, 2 * 60 * 1000);

  } catch (e) {
    console.log(red("Startup Error:"), e);
    setTimeout(startBot, 5000);
  }
}

process.on("uncaughtException", (err) => { console.error(err); });
process.on("unhandledRejection", (err) => { console.error(err); });

startBot();
