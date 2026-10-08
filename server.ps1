$ErrorActionPreference = 'Stop'
$script:Root = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'
$script:OllamaUrl = 'http://127.0.0.1:11434'
$script:Model = 'qwen2.5:3b'
$script:SystemPrompt = 'You are Atelier Form, a practical and friendly custom bag design guide. Help users choose bag shapes, colors, sizes, materials, and patterns that suit their personal style and daily needs. Each user message includes their current bag configuration, estimated price, and budget; treat these details as the source of truth and tailor every recommendation to them. Respect the stated budget, explain price trade-offs using the provided estimate, and suggest specific lower-cost changes when the current design exceeds the budget. Give concise, useful advice about material care, durability, function, and coordinating colors or patterns. Do not claim to see the visual preview or promise exact production prices. The displayed estimate is indicative. Ask a brief clarifying question only when it would materially improve the recommendation.'
$script:MimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg' = 'image/svg+xml'
  '.png' = 'image/png'
  '.ico' = 'image/x-icon'
}

function Send-HttpResponse($Client, [int]$Status, [string]$ContentType, [byte[]]$Body) {
  $reason = switch ($Status) {
    200 { 'OK' }
    400 { 'Bad Request' }
    404 { 'Not Found' }
    413 { 'Payload Too Large' }
    502 { 'Bad Gateway' }
    503 { 'Service Unavailable' }
    default { 'Error' }
  }
  $headers = "HTTP/1.1 $Status $reason`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $stream = $Client.GetStream()
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) { $stream.Write($Body, 0, $Body.Length) }
}

function Send-Json($Client, [int]$Status, $Value) {
  $json = ConvertTo-Json -InputObject $Value -Depth 12 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  Send-HttpResponse $Client $Status 'application/json; charset=utf-8' $bytes
}

function Handle-Request($Client) {
  $stream = $Client.GetStream()
  $headerBuffer = New-Object System.Collections.Generic.List[byte]
  $headerEnd = [byte[]](13, 10, 13, 10)
  while ($headerBuffer.Count -lt 16384) {
    $next = $stream.ReadByte()
    if ($next -lt 0) { return }
    $headerBuffer.Add([byte]$next)
    $count = $headerBuffer.Count
    if ($count -ge 4 -and $headerBuffer[$count - 4] -eq 13 -and $headerBuffer[$count - 3] -eq 10 -and $headerBuffer[$count - 2] -eq 13 -and $headerBuffer[$count - 1] -eq 10) { break }
  }
  if ($headerBuffer.Count -ge 16384) {
    Send-Json $Client 400 @{ error = 'Request headers are too large.' }
    return
  }

  $headerText = [System.Text.Encoding]::ASCII.GetString($headerBuffer.ToArray())
  $lines = $headerText -split "`r`n"
  $requestParts = $lines[0] -split ' ', 3
  if ($requestParts.Count -lt 2) {
    Send-Json $Client 400 @{ error = 'Invalid HTTP request.' }
    return
  }
  $method = $requestParts[0].ToUpperInvariant()
  $requestPath = ([Uri]::UnescapeDataString(($requestParts[1] -split '\?', 2)[0]))
  $contentLength = 0
  foreach ($line in $lines) {
    if ($line -match '^Content-Length:\s*(\d+)') { $contentLength = [int]$Matches[1] }
  }

  if ($method -eq 'GET' -and $requestPath -eq '/api/status') {
    try {
      $tags = Invoke-RestMethod -Uri "$script:OllamaUrl/api/tags" -TimeoutSec 3
      $ready = @($tags.models | Where-Object { $_.name -eq $script:Model -or $_.model -eq $script:Model }).Count -gt 0
      Send-Json $Client 200 @{ ollamaAvailable = $true; modelReady = $ready; model = $script:Model }
    } catch {
      Send-Json $Client 200 @{ ollamaAvailable = $false; modelReady = $false; model = $script:Model }
    }
    return
  }

  if ($method -eq 'POST' -and $requestPath -eq '/api/chat') {
    if ($contentLength -le 0 -or $contentLength -gt 65536) {
      Send-Json $Client 413 @{ error = 'The chat request is empty or too large.' }
      return
    }
    $bodyBytes = New-Object byte[] $contentLength
    $received = 0
    while ($received -lt $contentLength) {
      $read = $stream.Read($bodyBytes, $received, $contentLength - $received)
      if ($read -le 0) { break }
      $received += $read
    }
    if ($received -ne $contentLength) {
      Send-Json $Client 400 @{ error = 'Incomplete chat request.' }
      return
    }
    try {
      $input = [System.Text.Encoding]::UTF8.GetString($bodyBytes) | ConvertFrom-Json
      $messages = @($input.messages)
      if ($messages.Count -lt 1 -or $messages.Count -gt 14) { throw 'Invalid message count.' }
      $safeMessages = @()
      foreach ($message in $messages) {
        if ($message.role -notin @('user', 'assistant') -or [string]::IsNullOrWhiteSpace([string]$message.content) -or ([string]$message.content).Length -gt 2400) { throw 'Invalid message.' }
        $safeMessages += @{ role = [string]$message.role; content = [string]$message.content }
      }
      if ($safeMessages[-1].role -ne 'user') { throw 'Last message must be from the user.' }
      $ollamaMessages = @(@{ role = 'system'; content = $script:SystemPrompt }) + $safeMessages
      $payload = @{ model = $script:Model; stream = $false; messages = $ollamaMessages; options = @{ temperature = 0.7 } } | ConvertTo-Json -Depth 12 -Compress
      $reply = Invoke-RestMethod -Uri "$script:OllamaUrl/api/chat" -Method Post -ContentType 'application/json' -Body $payload -TimeoutSec 180
      Send-Json $Client 200 @{ message = $reply.message }
    } catch {
      $errorMessage = 'Ollama could not complete the request.'
      if ($_.ErrorDetails.Message) {
        try {
          $upstreamError = $_.ErrorDetails.Message | ConvertFrom-Json
          if ($upstreamError.error) { $errorMessage = [string]$upstreamError.error }
        } catch { }
      } elseif ($_.Exception.Message -match 'Invalid message|Invalid message count|Last message') {
        $errorMessage = 'Invalid chat messages. Please try again.'
      } elseif ($_.Exception.Message -match 'Unable to connect|actively refused|No connection') {
        $errorMessage = 'Cannot reach Ollama at 127.0.0.1:11434.'
      }
      $status = if ($errorMessage -like 'Cannot reach Ollama*') { 503 } else { 502 }
      Send-Json $Client $status @{ error = $errorMessage }
    }
    return
  }

  if ($method -ne 'GET' -and $method -ne 'HEAD') {
    Send-Json $Client 404 @{ error = 'Endpoint not found.' }
    return
  }

  try {
    if ($requestPath -eq '/') { $requestPath = '/index.html' }
    $relativePath = $requestPath.TrimStart('/') -replace '/', [System.IO.Path]::DirectorySeparatorChar
    $filePath = [System.IO.Path]::GetFullPath((Join-Path $script:Root $relativePath))
    if (-not $filePath.StartsWith($script:Root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
      Send-Json $Client 404 @{ error = 'File not found.' }
      return
    }
    $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
    $mime = if ($script:MimeTypes.ContainsKey($extension)) { $script:MimeTypes[$extension] } else { 'application/octet-stream' }
    $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
    if ($method -eq 'HEAD') { $fileBytes = [byte[]]@() }
    Send-HttpResponse $Client 200 $mime $fileBytes
  } catch {
    Send-Json $Client 400 @{ error = 'Invalid file path.' }
  }
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 8000)
$listener.Start()
Write-Host 'Atelier Form bag designer is running at http://127.0.0.1:8000'
Write-Host "Local chat model: $script:Model (Ollama at $script:OllamaUrl)"
Write-Host 'Press Ctrl+C to stop the local server.'
try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try { Handle-Request $client }
    catch { Write-Warning $_.Exception.Message }
    finally { $client.Close() }
  }
} finally {
  $listener.Stop()
}
