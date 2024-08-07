param(
    [string]$filePath
)

# Validate the file path
if (-not (Test-Path $filePath)) {
    Write-Error "File path does not exist."
    exit 1
}

# Use COM object to show the Open With dialog
$Shell = New-Object -ComObject Shell.Application
$folder = $Shell.Namespace((Get-Item $filePath).DirectoryName)
$file = $folder.ParseName((Get-Item $filePath).Name)

# Open the file with "Open With" dialog
$file.InvokeVerb("openas")
