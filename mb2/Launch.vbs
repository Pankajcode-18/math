Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
WshShell.Run "node_modules\.bin\electron.cmd . 2>nul", 0, False
