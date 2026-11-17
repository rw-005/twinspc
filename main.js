const { app, BrowserWindow, Menu, protocol, net, shell, ipcMain, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { execFile } = require('child_process');
const netSock = require('net');

const APP_DIR = path.join(__dirname, 'app');
const HOST = 'app://pos/';
let win = null;

/* ---- pengaturan tersimpan (printer Windows yang dipilih untuk cetak biasa) ---- */
const CFG_FILE = () => path.join(app.getPath('userData'), 'desktop-config.json');
let cfg = { printer: '' };
function loadCfg() { try { cfg = Object.assign(cfg, JSON.parse(fs.readFileSync(CFG_FILE(), 'utf8'))); } catch (e) {} }
function saveCfg() { try { fs.writeFileSync(CFG_FILE(), JSON.stringify(cfg)); } catch (e) {} }

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

/* ---- dialog printer Windows ---- */
async function printers() {
  try { return await win.webContents.getPrintersAsync(); } catch (e) { return []; }
}

/* ---- cetak mentah ESC/POS ke printer Windows (USB / driver) ---- */
function rawPrint(printerName, b64) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') return reject(new Error('Cetak ke printer Windows hanya di Windows'));
    if (!printerName) return reject(new Error('Printer belum dipilih'));
    const tmp = path.join(os.tmpdir(), 'twinspos-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.bin');
    try { fs.writeFileSync(tmp, Buffer.from(b64 || '', 'base64')); } catch (e) { return reject(new Error('Tidak bisa menulis data cetak')); }
    let script = path.join(__dirname, 'raw-print.ps1');
    script = script.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Printer', printerName, '-File', tmp],
      { windowsHide: true, timeout: 20000 }, (err, so, se) => {
        try { fs.unlinkSync(tmp); } catch (e) {}
        if (err) return reject(new Error((se || err.message || 'gagal').toString().trim().split('\n')[0]));
        resolve({});
      });
  });
}

/* ---- cetak LAN langsung ke IP:port (sama seperti APK) ---- */
function tcpSend(ip, port, b64) {
  return new Promise((resolve, reject) => {
    if (!ip || !String(ip).trim()) return reject(new Error('IP printer belum diisi'));
    const buf = Buffer.from(b64 || '', 'base64');
    let tries = 0;
    const once = () => {
      tries++;
      const s = netSock.connect({ host: String(ip).trim(), port: +port || 9100, timeout: 5000 });
      let done = false;
      const fail = m => { if (done) return; done = true; s.destroy(); tries < 3 ? setTimeout(once, 400) : reject(new Error(m)); };
      s.on('connect', () => s.end(buf, () => { if (done) return; done = true; resolve({}); }));
      s.on('timeout', () => fail('Printer ' + ip + ' tidak merespons'));
      s.on('error', e => fail('Printer: ' + e.message));
    };
    once();
  });
}

/* ---- cetak halaman (struk HTML) diam-diam ke printer terpilih / default ---- */
function systemPrint() {
  return new Promise((resolve, reject) => {
    const opt = { silent: true, printBackground: true, margins: { marginType: 'none' } };
    if (cfg.printer) opt.deviceName = cfg.printer;
    win.webContents.print(opt, (ok, why) => ok ? resolve({}) : reject(new Error(why || 'dibatalkan')));
  });
}

function reg() {
  const h = (n, f) => ipcMain.handle('tp:' + n, async (e, a) => { try { return (await f(a || {})) || {}; } catch (err) { return { __err: err.message || String(err) }; } });
  h('launchInfo', () => ({ restored: false }));
  h('appInfo', () => ({ code: 999999, name: app.getVersion() })); // tidak memicu pesan "update APK"
  h('openUrl', a => { if (/^https?:\/\//i.test(a.url || '')) shell.openExternal(a.url); });
  h('tcpSend', a => tcpSend(a.ip, a.port, a.data));
  // "Bluetooth" di POS = daftar printer Windows (dipakai untuk cetak ESC/POS mentah, termasuk USB)
  h('btList', async () => ({ devices: (await printers()).map(p => ({ name: p.displayName || p.name, address: p.name })) }));
  h('btSend', a => rawPrint(a.address, a.data));
  h('openPrinters', () => shell.openExternal('ms-settings:printers'));
  h('systemPrint', () => systemPrint());
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Aplikasi', submenu: [
      { label: 'Muat ulang', accelerator: 'F5', click: () => win && win.webContents.reload() },
      { label: 'Layar penuh', accelerator: 'F11', click: () => win && win.setFullScreen(!win.isFullScreen()) },
      { type: 'separator' },
      { label: 'Keluar', accelerator: 'Alt+F4', click: () => app.quit() }
    ] },
    { label: 'Printer', submenu: [
      { label: 'Pilih printer Windows untuk cetak biasa…', click: async () => {
        const ps = await printers();
        if (!ps.length) { dialog.showMessageBox(win, { type: 'info', message: 'Tidak ada printer terpasang di Windows.' }); return; }
        const names = ps.map(p => p.name);
        const r = await dialog.showMessageBox(win, {
          type: 'question', title: 'Pilih printer', message: 'Printer untuk cetak struk biasa',
          detail: 'Saat ini: ' + (cfg.printer || '(default Windows)') + '\n\nUntuk printer thermal lewat Pengaturan > Perangkat di POS, pilih printer yang sama di daftar "Bluetooth".',
          buttons: names.slice(0, 8).concat(['Pakai default Windows', 'Batal']), cancelId: names.slice(0, 8).length + 1
        });
        if (r.response < Math.min(names.length, 8)) { cfg.printer = names[r.response]; saveCfg(); }
        else if (r.response === Math.min(names.length, 8)) { cfg.printer = ''; saveCfg(); }
      } },
      { label: 'Buka pengaturan printer Windows', click: () => shell.openExternal('ms-settings:printers') }
    ] }
  ]));
}

function create() {
  win = new BrowserWindow({
    width: 1366, height: 800, minWidth: 900, minHeight: 600, show: false, title: 'TWINS POS', backgroundColor: '#f4f6fb',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false }
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(HOST)) { e.preventDefault(); if (/^https?:\/\//i.test(url)) shell.openExternal(url); } });
  win.loadURL(HOST + 'index.html');
}

app.whenReady().then(() => {
  loadCfg();
  // sajikan folder app/ lewat app://pos/ (origin tetap, jadi data kasir tidak hilang antar update)
  protocol.handle('app', req => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/' || p === '') p = '/index.html';
    const f = path.normalize(path.join(APP_DIR, p));
    if (!f.startsWith(APP_DIR)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(f).toString());
  });
  // kamera (absen selfie, scan) diizinkan untuk aplikasi ini saja
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'mediaKeySystem', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen'].includes(perm)));
  reg(); create(); buildMenu();
});
app.on('window-all-closed', () => app.quit());
