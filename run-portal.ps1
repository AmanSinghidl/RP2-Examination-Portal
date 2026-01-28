Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Push-Location "frontend-react"
npm run build
Pop-Location

node "Backend/server.js"
