$docPath = Join-Path -Path $PSScriptRoot -ChildPath "..\templates\FORMATO DESCUENTO DE ESTAMPILLAS.doc"
$docxPath = Join-Path -Path $PSScriptRoot -ChildPath "..\templates\FORMATO DESCUENTO DE ESTAMPILLAS_CONVERTIDO.docx"

# Convert relative paths to absolute paths
$docPath = [System.IO.Path]::GetFullPath($docPath)
$docxPath = [System.IO.Path]::GetFullPath($docxPath)

Write-Host "Intentando convertir de: $docPath a: $docxPath usando Word COM..."

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $doc = $word.Documents.Open($docPath)
    # 16 corresponds to wdFormatXMLDocument (.docx)
    $doc.SaveAs($docxPath, 16)
    $doc.Close()
    $word.Quit()
    Write-Host "✅ ¡Conversión exitosa!"
}
catch {
    Write-Host "❌ Error en la conversión: $_"
}
