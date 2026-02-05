const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")

const qrcode = require("qrcode-terminal")
const Pino = require("pino")
const readline = require("readline")
const fs = require("fs")

// GLOBAL STATE
let startTime = Date.now()
let msgCount = 0
let errCount = 0
let lastLog = "-"
let lastCPU = 0
let reconnecting = false
let pairingInProgress = false
global.sock = null
global.pairNumber = null

// CPU
let lastCPUTime = process.cpuUsage()
setInterval(() => {
    const now = process.cpuUsage()
    lastCPU = (
        (now.user - lastCPUTime.user + now.system - lastCPUTime.system) /
        1000
    ).toFixed(1)
    lastCPUTime = now
}, 1000)

// HELPERS
function formatUptime(ms) {
    let s = Math.floor(ms / 1000)
    let m = Math.floor(s / 60)
    let h = Math.floor(m / 60)
    s %= 60; m %= 60
    return `${h}h ${m}m ${s}s`
}
function getRam() {
    return (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + " MB"
}
function green(t) { return `\x1b[32m${t}\x1b[0m` }
function red(t) { return `\x1b[31m${t}\x1b[0m` }
function yellow(t) { return `\x1b[33m${t}\x1b[0m` }

// PANEL
function panel(status, device, ping = "-", showSource = false) {
    console.clear()
    console.log(`
┌─────────────────────────────────────────────┐
│            ${green("AXIOM BOT V4 ULTRA")}            │
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
│ Menu:
│ 1) Restart Bot
│ 2) Refresh Panel
│ 3) Tautkan Perangkat (QR / Pairing)
│ 4) Matikan Bot
│ 5) Logout / Hapus Auth
│ 6) About / Source
├─────────────────────────────────────────────┤
│ Log:
│ ${yellow(lastLog)}
${showSource ? `
├─────────────────────────────────────────────┤
│ Author  : Rangga
│ Writer  : ChatGPT
│ Desainer: Rangga & ChatGPT
│ Versi   : Axiom V4 Ultra
` : ""}
└─────────────────────────────────────────────┘
`)
}

// MENU
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function setupMenu(sock) {
    rl.removeAllListeners("line")
    rl.on("line", async (input) => {
        switch (input.trim()) {
            case "1":
                restartBot()
                break

            case "2":
                panel("Terhubung ✓", sock?.user?.id?.split(":")[0] || "-", "-")
                break

            case "3":
                linkDeviceMenu(sock)
                break

            case "4":
                process.exit(0)
                break

            case "5":
                console.log(red("Menghapus session..."))
                try { fs.rmSync("./auth", { recursive: true, force: true }) } catch {}
                restartBot()
                break

            case "6":
                panel(
                    "Terhubung ✓",
                    sock?.user?.id?.split(":")[0] || "-",
                    "-",
                    true
                )
                break
        }
    })
}

// MENU TAUTKAN
function linkDeviceMenu(sock) {
    console.clear()
    console.log(`
Tautkan Perangkat:
1) QR Code
2) Pairing Code
`)
    rl.question("> ", async (x) => {
        if (x == "1") {
            global.pairNumber = null
            pairingInProgress = false
            console.log(green("→ Menampilkan QR..."))
            panel("Scan QR!", "Belum Login")
        }

        if (x == "2") {
            rl.question("Masukkan nomor (628xx): ", async (num) => {
                if (!num.startsWith("628")) {
                    console.log(red("Format salah. Gunakan 628xxxx"))
                    return
                }
                global.pairNumber = num
                pairingInProgress = true
                console.log(green("\n→ Mencoba pairing...\n"))
            })
        }
    })
}

// RESTART
function restartBot() {
    startTime = Date.now()
    msgCount = 0
    errCount = 0
    lastLog = "-"
    pairingInProgress = false
    global.pairNumber = null

    delete require.cache[require.resolve("./index.js")]
    process.removeAllListeners("uncaughtException")
    process.removeAllListeners("unhandledRejection")

    startBot()
}

// START BOT
async function startBot() {
    try {
        if (global.sock) {
            try { global.sock.end?.() } catch {}
            try { global.sock.ws?.close?.() } catch {}
        }

        const { state, saveCreds } = await useMultiFileAuthState("./auth")
        const { version } = await fetchLatestBaileysVersion()

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: Pino({ level: "silent" })
        })

        global.sock = sock
        setupMenu(sock)
        panel("Menunggu Login...", "-")

        // CONNECTION EVENTS
        sock.ev.on("connection.update", async (u) => {
            const { qr, connection, lastDisconnect, pairingCode } = u

            // --------------------
            // PAIRING MODE
            // --------------------
            if (pairingInProgress && global.pairNumber) {
                try {
                    const code = await sock.requestPairingCode(global.pairNumber)
                    console.log(green("\nPAIRING CODE : " + code + "\n"))
                } catch (e) {
                    console.log(red("Gagal membuat pairing code!"))
                }
                pairingInProgress = false
            }

            // QR MODE
            if (!pairingInProgress && qr) {
                panel("Scan QR!", "Belum Login")
                qrcode.generate(qr, { small: true })
            }

            // CONNECTED
            if (connection === "open") {
                reconnecting = false
                panel(green("Terhubung ✓"), sock.user.id.split(":")[0])
            }

            // DISCONNECT
            if (connection === "close") {
                const code = lastDisconnect?.error?.output?.statusCode

                if (code === 401) {
                    try { fs.rmSync("./auth", { recursive: true, force: true }) } catch {}
                    console.log(red("Session Invalid → Hapus Auth"))
                    return restartBot()
                }

                if (!reconnecting) {
                    reconnecting = true
                    panel(red("Terputus, reconnect..."), "Reconnect")
                    setTimeout(startBot, 1800)
                }
            }
        })

        sock.ev.on("creds.update", saveCreds)

        // PESAN
        sock.ev.on("messages.upsert", async ({ messages }) => {
            const m = messages[0]
            if (!m.message) return
            if (!m.key.fromMe) msgCount++

            const from = m.key.remoteJid
            const text =
                m.message.conversation ||
                m.message.extendedTextMessage?.text ||
                ""

            lastLog = `${from} → ${text}`
            panel("Terhubung ✓", sock.user.id.split(":")[0])

            if (text === "ping") {
                let t = Date.now()
                await sock.sendMessage(from, { text: "pong!" })
                panel("Terhubung ✓", sock.user.id.split(":")[0], (Date.now() - t) + " ms")
            }
        })

        // ANTI CRASH
        process.on("uncaughtException", (err) => {
            errCount++
            lastLog = red("Error: " + err.message)
        })
        process.on("unhandledRejection", (err) => {
            errCount++
            lastLog = red("Reject: " + err)
        })

    } catch (e) {
        console.log("Startup Error:", e)
        setTimeout(startBot, 2000)
    }
}

startBot()