param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))

$ErrorActionPreference = 'Stop'
$releaseRoot = Join-Path $ProjectRoot 'artifacts'
$checksums = @{}
foreach ($line in [System.IO.File]::ReadAllLines((Join-Path $releaseRoot 'SHA256SUMS.txt'))) {
    if ($line -match '^([a-f0-9]{64})\s+(.+)$') { $checksums[$Matches[2]] = $Matches[1] }
}
$results = @()
foreach ($name in ($checksums.Keys | Sort-Object)) {
    $path = Join-Path $releaseRoot $name
    if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $checksums[$name]) {
        throw "Archive checksum mismatch: $name"
    }
    $basePath = if ($name -like '*-source.zip') { $ProjectRoot } elseif ($name -like '*-edge.zip') { Join-Path $ProjectRoot '.output\edge-mv3' } else { Join-Path $ProjectRoot '.output\chrome-mv3' }
    $basePath = [System.IO.Path]::GetFullPath($basePath)
    $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
    $count = 0
    try {
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName.EndsWith('/')) { continue }
            $relativeName = $entry.FullName
            if ($name -like '*-source.zip') {
                if (-not $relativeName.StartsWith('quietfeed/')) { throw "Unexpected source prefix: $relativeName" }
                $relativeName = $relativeName.Substring(10)
            }
            $original = [System.IO.Path]::GetFullPath((Join-Path $basePath $relativeName))
            if (-not $original.StartsWith($basePath + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path escapes project' }
            $stream = $entry.Open()
            $hasher = [System.Security.Cryptography.SHA256]::Create()
            try { $entryHash = [System.BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '') }
            finally { $stream.Dispose(); $hasher.Dispose() }
            if ($entryHash -ne (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash) { throw "Content mismatch: $relativeName" }
            $count++
        }
    } finally { $zip.Dispose() }
    $results += [PSCustomObject]@{ file = $name; entries = $count; checksum = 'PASS'; content = 'PASS' }
}
if ($results.Count -ne 3) { throw 'Expected three release archives' }
$results | ConvertTo-Json
