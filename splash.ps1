Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$splash = New-Object System.Windows.Forms.Form
$splash.Text            = "PM Schedule"
$splash.Size            = New-Object System.Drawing.Size(420, 220)
$splash.StartPosition   = "CenterScreen"
$splash.FormBorderStyle = "None"
$splash.BackColor       = [System.Drawing.Color]::FromArgb(15, 23, 42)
$splash.TopMost         = $true

$title = New-Object System.Windows.Forms.Label
$title.Text      = "PM Schedule"
$title.Font      = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
$title.Size      = New-Object System.Drawing.Size(400, 48)
$title.Location  = New-Object System.Drawing.Point(10, 28)
$title.TextAlign = "MiddleCenter"
$splash.Controls.Add($title)

$sub = New-Object System.Windows.Forms.Label
$sub.Text      = "Project Management & Scheduling"
$sub.Font      = New-Object System.Drawing.Font("Segoe UI", 9)
$sub.ForeColor = [System.Drawing.Color]::FromArgb(100, 116, 139)
$sub.Size      = New-Object System.Drawing.Size(400, 22)
$sub.Location  = New-Object System.Drawing.Point(10, 80)
$sub.TextAlign = "MiddleCenter"
$splash.Controls.Add($sub)

$div = New-Object System.Windows.Forms.Panel
$div.Size      = New-Object System.Drawing.Size(360, 1)
$div.Location  = New-Object System.Drawing.Point(30, 112)
$div.BackColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$splash.Controls.Add($div)

$prog = New-Object System.Windows.Forms.ProgressBar
$prog.Style   = "Continuous"
$prog.Minimum = 0
$prog.Maximum = 100
$prog.Value   = 0
$prog.Size    = New-Object System.Drawing.Size(360, 8)
$prog.Location = New-Object System.Drawing.Point(30, 148)
$splash.Controls.Add($prog)

$status = New-Object System.Windows.Forms.Label
$status.Text      = "Initializing..."
$status.Font      = New-Object System.Drawing.Font("Segoe UI", 8)
$status.ForeColor = [System.Drawing.Color]::FromArgb(100, 116, 139)
$status.Size      = New-Object System.Drawing.Size(400, 20)
$status.Location  = New-Object System.Drawing.Point(10, 166)
$status.TextAlign = "MiddleCenter"
$splash.Controls.Add($status)

$ver = New-Object System.Windows.Forms.Label
$ver.Text      = "v1.0"
$ver.Font      = New-Object System.Drawing.Font("Segoe UI", 7)
$ver.ForeColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$ver.Size      = New-Object System.Drawing.Size(400, 16)
$ver.Location  = New-Object System.Drawing.Point(10, 196)
$ver.TextAlign = "MiddleCenter"
$splash.Controls.Add($ver)

$splash.Show()
$splash.Refresh()

function Update-Splash($msg, $pct, $r = 100, $g = 116, $b = 139) {
    $status.Text      = $msg
    $prog.Value       = [Math]::Min([Math]::Max($pct, 0), 100)
    $status.ForeColor = [System.Drawing.Color]::FromArgb($r, $g, $b)
    $splash.Refresh()
}

Update-Splash "Checking for existing processes..." 5

foreach ($port in @(3001, 5173)) {
    try {
        $lines = netstat -ano 2>$null | Select-String ":$port\s"
        foreach ($line in $lines) {
            $parts = ($line -split '\s+') | Where-Object { $_ -ne '' }
            $pidVal = $parts[-1]
            if ($pidVal -match '^\d+$' -and $pidVal -ne '0') {
                Stop-Process -Id ([int]$pidVal) -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {}
}
Start-Sleep -Milliseconds 700

Update-Splash "Starting API server..." 15

Start-Process -FilePath "cmd" `
    -ArgumentList "/c node server.js" `
    -WorkingDirectory "C:\PMScheduleApp\server" `
    -WindowStyle Hidden

$maxWait = 20
$elapsed = 0
$serverReady = $false
while ($elapsed -lt $maxWait -and -not $serverReady) {
    Start-Sleep -Seconds 1
    $elapsed++
    $pct = 15 + [int]($elapsed / $maxWait * 35)
    Update-Splash "Waiting for API server... ($elapsed/$maxWait s)" $pct
    try {
        $rsp = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
        if ($rsp.StatusCode -eq 200) { $serverReady = $true }
    } catch {}
}

if (-not $serverReady) {
    Update-Splash "API server failed. Is Node.js installed?" 50 239 68 68
    Start-Sleep -Seconds 3
    $splash.Close(); $splash.Dispose(); exit 1
}

Update-Splash "API server ready!" 52 34 197 94
Start-Sleep -Milliseconds 300

Update-Splash "Starting web client..." 55

Start-Process -FilePath "cmd" `
    -ArgumentList "/c npm run dev" `
    -WorkingDirectory "C:\PMScheduleApp\client" `
    -WindowStyle Hidden

$maxWait = 30
$elapsed = 0
$clientReady = $false
while ($elapsed -lt $maxWait -and -not $clientReady) {
    Start-Sleep -Seconds 1
    $elapsed++
    $pct = 55 + [int]($elapsed / $maxWait * 38)
    Update-Splash "Waiting for web client... ($elapsed/$maxWait s)" $pct
    try {
        $rsp = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
        if ($rsp.StatusCode -eq 200) { $clientReady = $true }
    } catch {}
}

if (-not $clientReady) {
    Update-Splash "Web client timed out - opening browser anyway..." 93 245 158 11
    Start-Sleep -Milliseconds 800
}

Update-Splash "Launching browser..." 96 59 130 246
$splash.Refresh()
Start-Sleep -Milliseconds 300

Start-Process "http://localhost:5173"

Update-Splash "PM Schedule is ready!" 100 59 130 246
$splash.Refresh()
Start-Sleep -Milliseconds 1200

$splash.Close()
$splash.Dispose()
