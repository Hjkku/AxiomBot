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
global.sock = null

// CPU USAGE LIGHT
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
    s %= 60
    m %= 60
    return `${h}h ${m}m ${s}s`
}

function getRam() {
    return (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + " MB"
}

function green(t){return `\x1b[32m${t}\x1b[0m`}
function red(t){return `\x1b[31m${t}\x1b[0m`}
function yellow(t){return `\x1b[33m${t}\x1b[0m`}

// PANEL
function panel(status, device, ping = "-", showSource = false) {
    console.clear()
    console.log(`
┌─────────────────────────────────────────────┐
│        ${green("AXIOM BOT PANEL • ULTRA")}        │
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
│ 2) Clear Panel
│ 3) Tampilkan QR
│ 4) Matikan Bot
│ 5) Logout Auth
│ 6) Source / Credits
├─────────────────────────────────────────────┤
│ Log Terakhir:
│ ${yellow(lastLog)}
${showSource ? `
├─────────────────────────────────────────────┤
│ ${green("Source & Credits")}
│ Author       : Rangga
│ Script Writer: ChatGPT
│ Designer     : Rangga & ChatGPT
│ Versi Bot    : AXIOM Ultra Stable
` : ""}
└─────────────────────────────────────────────┘
`)
}

// TERMINAL MENU
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function setupMenu(sock) {
    rl.removeAllListeners("line")
    rl.on("line", async (input) => {
        switch (input.trim()) {

            case "1":
                console.log(red("\n→ Restarting bot...\n"))
                restartBot()
                break

            case "2":
                panel("Terhubung ✓", sock?.user?.id?.split(":")[0] || "-")
                break

            case "3":
                if (global.lastQR) qrcode.generate(global.lastQR, { small: true })
                else console.log(red("Tidak ada QR."))
                break

            case "4":
                console.log(red("→ Bot dimatikan"))
                process.exit(0)
                break

            case "5":
                console.log(red("\n→ Menghapus session auth...\n"))
                try { fs.rmSync("./auth", { recursive: true, force: true }) } catch {}
                console.log(green("Sukses hapus auth. Restart bot & scan ulang."))
                break

            case "6":
                panel("Terhubung ✓", sock?.user?.id?.split(":")[0], "-", true)
                break

            default:
                console.log(yellow("Perintah tidak dikenal."))
        }
    })
}

// INTERNAL RESTART
function restartBot() {
    startTime = Date.now()
    msgCount = 0
    errCount = 0
    lastLog = "-"
    reconnecting = false

    delete require.cache[require.resolve("./axiom.js")]
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
            logger: Pino({ level: "silent" })
        })

        global.sock = sock
        setupMenu(sock)
        panel("Menunggu QR...", "Belum Login")

        // CONNECTION EVENTS
        sock.ev.on("connection.update", async (update) => {
            const { qr, connection, lastDisconnect } = update

            if (qr) {
                global.lastQR = qr
                panel("Scan QR!", "Belum Login")
                qrcode.generate(qr, { small: true })
            }

            if (connection === "open") {
                reconnecting = false
                panel(green("Terhubung ✓"), sock.user.id.split(":")[0])
            }

            if (connection === "close") {
                const code = lastDisconnect?.error?.output?.statusCode

                if (code === 401) {
                    panel(red("Session Invalid! Menghapus auth..."), "Reset")
                    try { fs.rmSync("./auth", { recursive: true, force: true }) } catch {}
                    return restartBot()
                }

                if (!reconnecting) {
                    reconnecting = true
                    panel(red("Terputus, reconnect..."), "Reconnect")
                    setTimeout(startBot, 2500)
                }
            }
        })

        sock.ev.on("creds.update", saveCreds)

        // MESSAGE EVENT
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
            panel("Terhubung ✓", sock.user.id.split(":")[0])

            if (text === "ping") {
                let t = Date.now()
                await sock.sendMessage(from, { text: "pong!" })
                let ping = Date.now() - t
                panel("Terhubung ✓", sock.user.id.split(":")[0], ping + " ms")
            }
        })

        // ERROR HANDLER
        process.on("uncaughtException", (err) => {
            errCount++
            lastLog = red("Error: " + err.message)
            panel(red("Error!"), "Running")
        })

        process.on("unhandledRejection", (err) => {
            errCount++
            lastLog = red("Reject: " + err)
            panel(red("Error!"), "Running")
        })

    } catch (e) {
        console.log(red("Startup Error:"), e)
        setTimeout(startBot, 2000)
    }
}

startBot()