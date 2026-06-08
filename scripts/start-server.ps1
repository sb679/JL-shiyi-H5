$ErrorActionPreference = 'Stop'

$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir

$env:PORT = if ($env:PORT) { $env:PORT } else { '8080' }

$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodePath) {
	$Candidates = @(
		"$env:ProgramFiles\nodejs\node.exe",
		"${env:ProgramFiles(x86)}\nodejs\node.exe"
	)
	$NodePath = $Candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $NodePath) {
	throw 'node.exe not found. Install Node.js or add it to PATH.'
}

& $NodePath server/index.js
