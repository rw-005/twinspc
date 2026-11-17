# Kirim byte mentah (ESC/POS) ke printer Windows (USB / driver terpasang) lewat winspool
param([Parameter(Mandatory=$true)][string]$Printer,[Parameter(Mandatory=$true)][string]$File)
$src = @"
using System;
using System.Runtime.InteropServices;
public class RawP {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr h, int level, [In] DOCINFO di);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr h, IntPtr b, int c, out int w);
  public static string Send(string printer, byte[] data) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) return "Printer tidak ditemukan / tidak bisa dibuka (kode " + Marshal.GetLastWin32Error() + ")";
    DOCINFO di = new DOCINFO(); di.pDocName = "TWINS POS"; di.pOutputFile = null; di.pDataType = "RAW";
    if (!StartDocPrinter(h, 1, di)) { int e = Marshal.GetLastWin32Error(); ClosePrinter(h); return "StartDoc gagal (kode " + e + ")"; }
    StartPagePrinter(h);
    IntPtr p = Marshal.AllocCoTaskMem(data.Length);
    Marshal.Copy(data, 0, p, data.Length);
    int w = 0;
    bool ok = WritePrinter(h, p, data.Length, out w);
    int err = Marshal.GetLastWin32Error();
    Marshal.FreeCoTaskMem(p);
    EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);
    return ok ? "OK" : "WritePrinter gagal (kode " + err + ")";
  }
}
"@
Add-Type -TypeDefinition $src
$bytes = [System.IO.File]::ReadAllBytes($File)
$r = [RawP]::Send($Printer, $bytes)
if ($r -ne "OK") { [Console]::Error.WriteLine($r); exit 1 }
