param([string]$Brief, [string]$Log, [string]$Model = 'gemini-4-hydrogen-high', [string]$Conversation = '',
  [string]$Timeout = '40m', [string]$Dir = 'C:\Users\Victor D\Desarrollo web\horacio')
# Runs Antigravity (agy) headless on Victor's subscription. The brief stays in a UTF-8 file because accents
# break on the command line; the prompt only points to it. Settings come from a file because Windows
# PowerShell 5.1 strips the quotes of inline JSON.
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $OutputEncoding
Set-Location $Dir
$settings = Join-Path $PSScriptRoot 'agy-settings.json'
$briefDir = Split-Path -Parent (Resolve-Path $Brief)
"AGY-START model=$Model $(Get-Date -Format s)" | Out-File -FilePath $Log -Encoding utf8
$prompt = "Lee el encargo completo en el archivo $Brief y cumplelo al pie de la letra. NO ejecutes ningun comando de terminal (ni servidores, ni navegadores, ni scripts): te cortan; Claude ejecuta tests y capturas. Usa solo tus herramientas de leer y escribir archivos. No hagas commits. Al terminar resume lo que cambiaste."
$agyArgs = @('--print', $prompt, '--model', $Model, '--mode', 'accept-edits', '--add-dir', $briefDir,
  '--settings', $settings, '--log-file', "$Log.debug.txt", '--print-timeout', $Timeout)
if ($Conversation) { $agyArgs = @('--conversation', $Conversation) + $agyArgs }
& agy @agyArgs 2>&1 | ForEach-Object { $line = if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message } else { "$_" }; if ($line -eq "System.Management.Automation.RemoteException") { $line = "" }; $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
$code = $LASTEXITCODE
# the conversation id lets a correction resume with everything the agent already read
$id = Select-String -Path "$Log.debug.txt" -Pattern 'conversation ([0-9a-f-]{36})' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($id) { "AGY-CONVERSATION $($id.Matches[0].Groups[1].Value)" | Add-Content -Path $Log -Encoding UTF8 }
"AGY-DONE exit=$code $(Get-Date -Format s)" | Add-Content -Path $Log -Encoding UTF8
