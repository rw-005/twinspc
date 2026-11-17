// Jembatan ke POS: meniru plugin "TwinsPrinter" yang dipakai APK, supaya POS berperilaku sama seperti di APK.
const { contextBridge, ipcRenderer } = require('electron');
const call = (name, args) => ipcRenderer.invoke('tp:' + name, args || {}).then(r => {
  if (r && r.__err) throw new Error(r.__err);
  return r;
});
const TwinsPrinter = {
  launchInfo: () => call('launchInfo'),
  appInfo: () => call('appInfo'),
  openUrl: a => call('openUrl', a),
  tcpSend: a => call('tcpSend', a),
  btList: () => call('btList'),
  btSend: a => call('btSend', a),
  openBtSettings: () => call('openPrinters'),
  systemPrint: () => call('systemPrint')
};
contextBridge.exposeInMainWorld('Capacitor', {
  isNativePlatform: () => true,
  getPlatform: () => 'electron',
  Plugins: { TwinsPrinter }
});
