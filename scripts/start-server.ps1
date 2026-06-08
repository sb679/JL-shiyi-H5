$ErrorActionPreference = 'Stop'

$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir

$env:PORT = if ($env:PORT) { $env:PORT } else { '3000' }

node server/index.js
