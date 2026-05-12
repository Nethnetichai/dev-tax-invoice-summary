$raw = [System.IO.File]::ReadAllBytes("d:\dev-tax-invoice-summary\src\fonts\Sarabun-Regular.ttf")
$b64 = [Convert]::ToBase64String($raw)
$content = "const SarabunFont = ``$b64``;" + [Environment]::NewLine + "export default SarabunFont;"
[System.IO.File]::WriteAllText("d:\dev-tax-invoice-summary\src\fonts\SarabunFont.js", $content)
Write-Host "Done! Font JS created."
