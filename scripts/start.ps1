$ErrorActionPreference = "Stop"

$nodePath = $null
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  try {
    & $node.Source --version | Out-Null
    $nodePath = $node.Source
  } catch {
    $nodePath = $null
  }
}

if (-not $nodePath) {
  $candidate = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if (Test-Path $candidate) {
    $nodePath = $candidate
  }
}

if (-not $nodePath) {
  throw "Could not find a runnable Node.js executable. Install Node.js or run from Codex with bundled runtimes available."
}

& $nodePath "src/server.js"
