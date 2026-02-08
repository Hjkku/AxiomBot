const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const qrcode = require("qrcode-terminal")
const Pino = require("pino")
const readline = require("readline")
const fs = require("fs")

// IMPORT COMMAND HANDLER
const commandHandler = require("./database/command")

// GLOBAL STATE
let startTime = Date.now()
let msgCount = 0
let errCount = 0
let reconnecting = false
let globalDevice = null
global.axiom = null
global.lastLogs = []     // simpan 4 log terakhir
global.consoleLog = []   // simpan 20 console log terakhir
global.lastQR = null

// CPU USAGE LIGHT
let lastCPUTime = process.cpuUsage()
let lastCPU = 0
setInterval(() => {
    const now = process.cpuUsage()
    lastCPU = ((now.user - lastCPUTime.user + now.system - lastCPUTime.system) / 1000).toFixed(1)
    lastCPUTime = now
}, 1000)

// HELPERS PANEL
function formatUptime(ms) {
    let s = Math.floor(ms / 1000)
    let m = Math.floor(s / 60)
    let h = Math.floor(m / 60)
    s %= 60
    m %= 60
    return `${h}h ${m}m ${s}s`
}
function getRam() { return (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + " MB" }
function green(t) { return `\x1b[32m${t}\x1b[0m` }
function red(t)   { return `\x1b[31m${t}\x1b[0m` }
function yellow(t){ return `\x1b[33m${t}\x1b[0m` }

// PANEL
function panel(status, device = "-", ping = "-") {
    console.clear()
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
│ Log Terakhir (4) :
${global.lastLogs.map(l => "│ " + l).join("\n")}
├─────────────────────────────────────────────┤
│ Console Log (20 terakhir):
${global.consoleLog.map(l => "│ " + l).join("\n")}
├─────────────────────────────────────────────┤
│ Menu Interaktif:
│ 1) Restart Bot
│ 2) Refresh/Clear Panel
│ 3) QR / Pairing
│ 4) Keluar / Log out
│ 5) About / Source
└─────────────────────────────────────────────┘
`)
}

// Tambah log ke panel & console
function pushLog(text) {
    global.lastLogs.push(text)
    if(global.lastLogs.length > 4) global.lastLogs.shift()
    global.consoleLog.push(text)
    if(global.consoleLog.length > 20) global.consoleLog.shift()
}

// TERMINAL MENU
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function setupMenu() {
    rl.removeAllListeners("line")
    rl.on("line", async (input) => {
        switch(input.trim()) {
            case "1":
                console.log(red("\n→ Restarting bot...\n"))
                restartBot()
                break
            case "2":
                panel("Terhubung ✓", globalDevice)
                break
            case "3":
                if(global.axiom) {
                    if(globalDevice) {
                        console.log(red(`Device ${globalDevice} masih tersambung. Tidak bisa buat tautkan baru.`))
                    } else if(global.lastQR) {
                        console.log(green("QR / Pairing tersedia. Scan sekarang:"))
                        qrcode.generate(global.lastQR, { small: true })
                    } else {
                        console.log(red("Tidak ada QR / Pairing."))
                    }
                }
                break
            case "4":
                console.log(red("→ Keluar bot"))
                process.exit(0)
                break
            case "5":
                panel("Terhubung ✓", globalDevice)
                break
            default:
                console.log(yellow("Perintah tidak dikenal."))
        }
    })
}

// RESTART BOT
function restartBot() {
    startTime = Date.now()
    msgCount = 0
    errCount = 0
    globalDevice = null

    delete require.cache[require.resolve("./axiom.js")]
    process.removeAllListeners("uncaughtException")
    process.removeAllListeners("unhandledRejection")
    startBot()
}

// START BOT
async function startBot() {
    try {
        if(global.axiom) {
            try { global.axiom.end?.() } catch {}
            try { global.axiom.ws?.close?.() } catch {}
        }

        const { state, saveCreds } = await useMultiFileAuthState("./axiomSesi")
        const { version } = await fetchLatestBaileysVersion()
        const axiom = makeWASocket({ version, auth: state, logger: Pino({ level: "silent" }) })
        global.axiom = axiom
        setupMenu()
        panel("Menunggu QR...", "-")

        // CONNECTION EVENTS
        axiom.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update

            if(qr) global.lastQR = qr

            if(connection === "open") {
                reconnecting = false
                globalDevice = axiom.user.id.split(":")[0]
                panel(green("Terhubung ✓"), globalDevice)
            }

            if(connection === "close") {
                const code = lastDisconnect?.error?.output?.statusCode
                if(!reconnecting) {
                    reconnecting = true
                    panel(red("Terputus, reconnect..."), globalDevice || "-")
                    setTimeout(() => startBot(), 2500)
                }
            }
        })

        axiom.ev.on("creds.update", saveCreds)

        // PESAN MASUK → COMMAND HANDLER
        axiom.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0]
            if(!msg.message) return
            if(!msg.key.fromMe) msgCount++

            const from = msg.key.remoteJid
            const number = from.includes("@") ? from.split("@")[0] : from
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
            pushLog(`${number} → ${text}`)

            try {
                await commandHandler(axiom, msg, number, text)
            } catch(e) {
                pushLog(red("Error di command.js / function.js: " + e.message))
                console.error("Error di command.js / function.js:", e)
            }

            panel("Terhubung ✓", globalDevice)
        })

        // ANTI CRASH
        process.on("uncaughtException", (err) => {
            errCount++
            pushLog(red("Uncaught: " + err.message))
            panel(red("Error!"), globalDevice)
        })
        process.on("unhandledRejection", (err) => {
            errCount++
            pushLog(red("Rejection: " + err))
            panel(red("Error!"), globalDevice)
        })

    } catch(e) {
        pushLog(red("Startup Error: " + e.message))
        console.error("Startup Error:", e)
        setTimeout(startBot, 2000)
    }
}

startBot()