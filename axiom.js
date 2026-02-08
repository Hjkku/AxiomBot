// axiom.js
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
let lastLogs = [] // simpan 4 log terakhir
let lastCPU = 0
let reconnecting = false
global.axiom = null

// CPU USAGE LIGHT
let lastCPUTime = process.cpuUsage()
setInterval(() => {
    const now = process.cpuUsage()
    lastCPU = (
        (now.user - lastCPUTime.user + now.system - lastCPUTime.system)
        / 1000
    ).toFixed(1)
    lastCPUTime = now
}, 1000)

// ------------------------- HELPERS -------------------------
function formatUptime(ms) {
    let s = Math.floor(ms / 1000)
    let m = Math.floor(s / 60)
    let h = Math.floor(m / 60)
    s %= 60
    m %= 60
    return `${h}h ${m}m ${s}s`
}

function getRam() {
    return (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + " MB"
}

function green(t) { return `\x1b[32m${t}\x1b[0m` }
function red(t) { return `\x1b[31m${t}\x1b[0m` }
function yellow(t) { return `\x1b[33m${t}\x1b[0m` }

// Log helper
function addLog(msg) {
    const now = new Date().toLocaleTimeString()
    const log = `[${now}] ${msg}`
    lastLogs.push(log)
    if (lastLogs.length > 4) lastLogs.shift() // simpan max 4 log terakhir
    console.log(yellow(log))
}

// ------------------------- PANEL -------------------------
function panel(status, device, ping = "-", showSource = false) {
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
│ 3) Tampilkan QR / Pairing
│ 4) Keluar/Log out
│ 5) About / Source
├─────────────────────────────────────────────┤
│ Log Terakhir:
│ ${lastLogs.join("\n│ ")}
${showSource ? `
├─────────────────────────────────────────────┤
│ ${green("Source & Credits")}
│ Author       : Rangga
│ Script Writer: ChatGPT
│ Designer     : Rangga & ChatGPT
│ Versi Bot    : Ultra Low RAM v2.0
` : ""}
└─────────────────────────────────────────────┘
`)
}

// ------------------------- TERMINAL MENU -------------------------
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function setupMenu(axiom) {
    rl.removeAllListeners("line")
    rl.on("line", async (input) => {
        switch (input.trim()) {
            case "1":
                addLog("→ Restarting bot...")
                restartBot()
                break
            case "2":
                panel("Terhubung ✓", axiom?.user?.id?.split(":")[0] || "-")
                break
            case "3":
                // Tampilkan pilihan QR atau Pairing
                if (global.axiom && axiom.user) {
                    addLog(`Device sedang tersambung: ${axiom.user.id.split(":")[0]}`)
                    console.log("QR / Pairing sedang aktif. Tidak bisa buat perangkat baru.")
                } else {
                    console.log("\nPilih metode:")
                    console.log("1) QR Code")
                    console.log("2) Pairing Code")
                    rl.question("Masukkan pilihan (1/2): ", async (choice) => {
                        if (choice.trim() === "1") {
                            if (global.lastQR) qrcode.generate(global.lastQR, { small: true })
                            else console.log(red("Tidak ada QR."))
                        } else if (choice.trim() === "2") {
                            rl.question("Masukkan nomor telepon (contoh 62xxxx): ", async (num) => {
                                try {
                                    const code = await axiom.requestPairingCode(num + "@s.whatsapp.net")
                                    console.log(green(`Pairing code: ${code}`))
                                } catch (e) {
                                    console.log(red("Gagal request pairing code: " + e.message))
                                }
                            })
                        } else {
                            console.log(yellow("Pilihan tidak dikenal."))
                        }
                    })
                }
                break
            case "4":
                addLog("→ Keluar bot")
                process.exit(0)
                break
            case "5":
                panel("Terhubung ✓", axiom?.user?.id?.split(":")[0] || "-", "-", true)
                break
            default:
                console.log(yellow("Perintah tidak dikenal."))
        }
    })
}

// ------------------------- INTERNAL RESTART -------------------------
function restartBot() {
    startTime = Date.now()
    msgCount = 0
    errCount = 0
    lastLogs = []
    reconnecting = false

    delete require.cache[require.resolve("./axiom.js")]

    process.removeAllListeners("uncaughtException")
    process.removeAllListeners("unhandledRejection")

    startBot()
}

// ------------------------- START BOT -------------------------
async function startBot() {
    try {
        if (global.axiom) {
            try { global.axiom.end?.() } catch {}
            try { global.axiom.ws?.close?.() } catch {}
        }

        const { state, saveCreds } = await useMultiFileAuthState("./axiomSesi")
        const { version } = await fetchLatestBaileysVersion()

        const axiom = makeWASocket({
            version,
            auth: state,
            logger: Pino({ level: "silent" })
        })

        global.axiom = axiom
        setupMenu(axiom)
        panel("Menunggu QR / Pairing...", "Belum Login")

        // ------------------------- CONNECTION EVENTS -------------------------
        axiom.ev.on("connection.update", async (update) => {
            const { qr, connection, lastDisconnect } = update

            if (qr) {
                global.lastQR = qr
                addLog("QR code diterima, silakan scan")
            }

            if (connection === "open") {
                reconnecting = false
                addLog(`Terhubung ke device: ${axiom.user.id.split(":")[0]}`)
            }

            if (connection === "close") {
                const code = lastDisconnect?.error?.output?.statusCode
                if (code === 401) {
                    addLog("Session Invalid! Menghapus auth...")
                    try { fs.rmSync("./auth", { recursive: true, force: true }) } catch {}
                    addLog("Session dihapus. Scan QR lagi.")
                    return restartBot()
                }

                if (!reconnecting) {
                    reconnecting = true
                    addLog("Terputus, reconnect...")
                    setTimeout(() => startBot(), 2500)
                }
            }
        })

        axiom.ev.on("creds.update", saveCreds)

        // ------------------------- PESAN MASUK → COMMAND -------------------------
        axiom.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0]
            if (!msg.message) return

            if (!msg.key.fromMe) msgCount++

            const from = msg.key.remoteJid
            const number = from.includes("@") ? from.split("@")[0] : from
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""

            addLog(`${number} → ${text}`)

            try {
                await commandHandler(axiom, msg, from, text)
            } catch (e) {
                errCount++
                addLog(`Error di command.js / functions.js: ${e.message}`)
            }
        })

        // ------------------------- ANTI CRASH -------------------------
        process.on("uncaughtException", (err) => {
            errCount++
            addLog("Uncaught Error: " + err.message)
        })
        process.on("unhandledRejection", (err) => {
            errCount++
            addLog("Reject Error: " + err)
        })

    } catch (e) {
        addLog("Startup Error: " + e.message)
        setTimeout(startBot, 2000)
    }
}

startBot()