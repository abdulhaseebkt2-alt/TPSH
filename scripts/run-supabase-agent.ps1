# TPS Hostel IRP - Supabase SQL Migration Agent Runner
# Run this script to automatically execute all SQL migrations against Supabase.

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   TPS HOSTEL IRP: SUPABASE SQL MIGRATION AGENT" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan

$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path "$ScriptPath\.."

# Check if node is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not found on your system." -ForegroundColor Red
    exit 1
}

# Run the agent
node scripts/supabase-agent.js
