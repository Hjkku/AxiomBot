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
let lastLog = "-"
let lastCPU = 0
let reconnecting = false
global.axiom = null
let globalDevice = null
let lastQR = null

// CPU USAGE LIGHT
let lastCPUTime = process.cpuUsage()
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
function panel(status, device, ping = "-", showSource = false) {
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
│ Menu Interaktif:
│ 1) Restart Bot
│ 2) Refresh/Clear Panel
│ 3) QR / Pairing
│ 4) Keluar / Log out
│ 5) About / Source
├─────────────────────────────────────────────┤
│ Log Terakhir:
│ ${yellow(lastLog)}
${showSource ? `
├─────────────────────────────────────────────┤
│ ${green("Source & Credits")}
│ Author       : Rangga
│ Script Writer: ChatGPT
│ Versi Bot    : Ultra Low RAM v2.0
` : ""}
└─────────────────────────────────────────────┘
`)
}

// TERMINAL MENU
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function setupMenu() {
    rl.removeAllListeners("line")
    rl.on("line", async (input) => {
        const cmd = input.trim()
        switch(cmd) {
            case "1":
                console.log(red("\n→ Restarting bot...\n"))
                restartBot()
                break
            case "2":
                panel("Terhubung ✓", globalDevice || "-", "-")
                break
            case "3":
                await showQRorPairing()
                break
            case "4":
                console.log(red("→ Keluar bot"))
                process.exit(0)
                break
            case "5":
                panel("Terhubung ✓", globalDevice || "-", "-", true)
                break
            default:
                console.log(yellow("Perintah tidak dikenal."))
        }
    })
}

// SHOW QR OR PAIRING
async function showQRorPairing() {
    if(globalDevice) {
        console.log(red(`QR / Pairing sedang tersambung ke ${globalDevice}, tidak bisa buat perangkat baru.`))
        return
    }

    const choice = await new Promise(res => {
        rl.question("Pilih metode:\n1) QR\n2) Pairing\nJawab 1/2: ", answer => res(answer.trim()))
    })

    if (choice === "1") {
        console.log(green("Silahkan scan QR yang muncul di terminal."))
        if (lastQR) qrcode.generate(lastQR, { small: true })
        else console.log(red("Belum ada QR tersedia."))
    } else if (choice === "2") {
        const number = await new Promise(res => {
            rl.question("Masukkan nomor target (contoh: 628xx): ", ans => res(ans.trim()))
        })

        if (!number.match(/^\d+$/)) {
            console.log(red("Nomor tidak valid! Harus angka semua."))
            return
        }

        try {
            const jid = number.includes("@") ? number : number + "@s.whatsapp.net"
            const code = await global.axiom.requestPairingCode(jid)
            console.log(green(`Pairing code untuk ${number}: ${code}`))
        } catch (e) {
            console.log(red("Gagal request pairing code:", e.message))
        }
    } else {
        console.log(yellow("Pilihan tidak valid."))
    }
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
        if(global.axiom) {
            try { global.axiom.end?.() } catch{}
            try { global.axiom.ws?.close?.() } catch{}
        }

        const { state, saveCreds } = await useMultiFileAuthState("./axiomSesi")
        const { version } = await fetchLatestBaileysVersion()

        const axiom = makeWASocket({
            version,
            auth: state,
            logger: Pino({ level: "silent" })
        })

        global.axiom = axiom
        setupMenu()
        panel("Menunggu QR / Pairing...", "-")

        axiom.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update
            if(qr) lastQR = qr

            if(connection === "open") {
                reconnecting = false
                globalDevice = axiom.user.id.split(":")[0]
                panel(green("Terhubung ✓"), globalDevice)
            }

            if(connection === "close") {
                const code = lastDisconnect?.error?.output?.statusCode
                if(code === 401) {
                    console.log(red("Session invalid. Hapus auth."))
                    try { fs.rmSync("./axiomSesi", { recursive: true, force: true }) } catch{}
                    restartBot()
                } else if(!reconnecting) {
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
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
            lastLog = `${from} → ${text}`
            panel("Terhubung ✓", globalDevice || "-")

            await commandHandler(axiom, msg, from, text)
        })

        // ANTI CRASH
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

    } catch(e) {
        console.log(red("Startup Error:"), e)
        setTimeout(startBot, 2000)
    }
}

// START
startBot()