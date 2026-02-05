const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    generateWAMessageFromContent,
} = require("@whiskeysockets/baileys")

const qrcode = require("qrcode-terminal")
const Pino = require("pino")
const readline = require("readline")
const fs = require("fs")

// =============== GLOBAL STATE ===============
let startTime = Date.now()
let msgCount = 0
let errCount = 0
let lastLog = "-"
let lastCPU = 0
let reconnecting = false
let isConnected = false
global.sock = null
global.lastQR = null

// =============== CPU MONITOR ===============
let lastCPUTime = process.cpuUsage()
setInterval(() => {
    const now = process.cpuUsage()
    lastCPU = (
        (now.user - lastCPUTime.user + now.system - lastCPUTime.system) / 1000
    ).toFixed(1)
    lastCPUTime = now
}, 1000)

// =============== HELPERS ===============
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

const green = (t) => `\x1b[32m${t}\x1b[0m`
const red = (t) => `\x1b[31m${t}\x1b[0m`
const yellow = (t) => `\x1b[33m${t}\x1b[0m`

// =============== PANEL ===============
function panel(status, device, ping = "-", showSource = false) {
    console.clear()
    console.log(`
┌──────────────────────────────────────────────────────────┐
│                ${green("AXIOM WHATSAPP BOT PANEL")}                   │
├──────────────────────────────────────────────────────────┤
│ Status   : ${status}
│ Device   : ${device}
│ Uptime   : ${formatUptime(Date.now() - startTime)}
│ CPU      : ${lastCPU} ms
│ RAM      : ${getRam()}
│ Ping     : ${ping}
│ Msg In   : ${msgCount}
│ Errors   : ${errCount}
├──────────────────────────────────────────────────────────┤
│ Menu Interaktif:
│ 1) Restart Bot
│ 2) Refresh Panel
│ 3) Tautkan Perangkat (QR / Pairing)
│ 4) Matikan Bot
│ 5) Logout Auth (Hapus Session)
│ 6) Tentang / Source
├──────────────────────────────────────────────────────────┤
│ Log Terakhir:
│ ${yellow(lastLog)}
${showSource ? `
├──────────────────────────────────────────────────────────┤
│ ${green("Source & Credits")}
│ Author        : Rangga
│ Script Writer : ChatGPT
│ Designer      : Rangga & ChatGPT
│ Versi Bot     : Axiom Ultra v3.0
` : ""}
└──────────────────────────────────────────────────────────┘
`)
}

// =============== TERMINAL MENU ===============
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function setupMenu(sock) {
    rl.removeAllListeners("line")
    rl.on("line", async (input) => {
        switch (input.trim()) {
            case "1":
                console.log(red("\n→ Restart bot...\n"))
                restartBot()
                break

            case "2":
                panel(
                    isConnected ? green("Terhubung ✓") : red("Tidak Terhubung"),
                    sock?.user?.id?.split(":")[0] || "-",
                    "-"
                )
                break

            case "3":
    console.log(green("Pilih metode:"))
    console.log("1) QR Code")
    console.log("2) Pairing Code")
    rl.question("> ", async (m) => {
        if (m == "1") {
            panel("Menunggu QR...", "QR Login")
            if (global.lastQR) qrcode.generate(global.lastQR, { small: true })
        }

        else if (m == "2") {
            console.log(yellow("→ Membuat pairing code..."))

            try {
                // Jalankan pembuat pairing code!
                const code = await sock.requestPairingCode()

                console.log(green("\n► Pairing Code: " + code + "\n"))
                console.log("Buka WhatsApp → Linked Devices → Masukkan kode ini\n")
            } catch (e) {
                console.log(red("Gagal membuat pairing code: " + e.message))
            }
        }

        else console.log(yellow("Pilihan tidak dikenal"))
    })
    break

            case "4":
                console.log(red("\n→ Bot dimatikan.\n"))
                process.exit(0)
                break

            case "5":
                console.log(red("\n→ Menghapus session & logout...\n"))
                try { fs.rmSync("./auth", { recursive: true, force: true }) } catch {}
                console.log(green("Session dihapus. Jalankan lagi untuk scan ulang.\n"))
                process.exit(0)
                break

            case "6":
                panel(
                    isConnected ? green("Terhubung ✓") : red("Tidak Terhubung"),
                    sock?.user?.id?.split(":")[0] || "-",
                    "-",
                    true
                )
                break

            default:
                console.log(yellow("Perintah tidak dikenal."))
        }
    })
}

// =============== RESTART INTERNAL ===============
function restartBot() {
    startTime = Date.now()
    msgCount = 0
    errCount = 0
    lastLog = "-"
    reconnecting = false
    isConnected = false

    delete require.cache[require.resolve("./axiom.js")]
    startBot()
}

// =============== START BOT MAIN ===============
async function startBot() {
    try {
        if (global.sock) {
            try { global.sock.end?.() } catch {}
            try { global.sock.ws?.close?.() } catch {}
        }

        const { state, saveCreds } = await useMultiFileAuthState("./auth")
        const { version } = await fetchLatestBaileysVersion()

        const sock = makeWASocket({
            logger: Pino({ level: "silent" }),
            version,
            auth: state,
            markOnlineOnConnect: false,
            printQRInTerminal: false,
        })

        global.sock = sock
        setupMenu(sock)
        panel("Menunggu koneksi...", "-", "-")

        // =============== EVENT CONNECTION ===============
        sock.ev.on("connection.update", async ({ qr, connection, lastDisconnect }) => {

            if (qr) {
                global.lastQR = qr
                isConnected = false
                panel("Scan QR!", "-", "-")
                qrcode.generate(qr, { small: true })
            }

            if (connection === "open") {
                isConnected = true
                reconnecting = false
                panel(green("Terhubung ✓"), sock.user.id.split(":")[0])
            }

            if (connection === "close") {
                isConnected = false
                const code = lastDisconnect?.error?.output?.statusCode

                if (code === 401) {
                    panel(red("Session Invalid — Menghapus auth..."), "Reset")
                    try { fs.rmSync("./auth", { recursive: true, force: true }) } catch {}
                    console.log(red("\n→ Session dihapus. Scan ulang.\n"))
                    return restartBot()
                }

                if (!reconnecting) {
                    reconnecting = true
                    panel(red("Terputus — Reconnect..."), "Reconnect")
                    setTimeout(() => startBot(), 2500)
                }
            }
        })

        sock.ev.on("creds.update", saveCreds)

        // =============== EVENT PESAN ===============
        sock.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0]
            if (!msg.message) return

            if (!msg.key.fromMe) msgCount++

            const from = msg.key.remoteJid
            const text =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                ""

            lastLog = `${from} → ${text}`
            panel(green("Terhubung ✓"), sock.user.id.split(":")[0])

            if (text === "ping") {
                let t = Date.now()
                await sock.sendMessage(from, { text: "pong!" })
                let ping = Date.now() - t
                panel(green("Terhubung ✓"), sock.user.id.split(":")[0], ping + " ms")
            }
        })

        // =============== ANTI-CRASH ===============
        process.on("uncaughtException", (err) => {
            errCount++
            lastLog = red(err.message)
            panel(red("Error!"), "-")
        })

        process.on("unhandledRejection", (err) => {
            errCount++
            lastLog = red(err)
            panel(red("Error!"), "-")
        })

    } catch (e) {
        console.log(red("Startup Error:"), e)
        setTimeout(startBot, 1500)
    }
}

startBot()
