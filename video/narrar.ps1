# Gera um WAV por cena com a voz pt-BR do Windows (Microsoft Maria).
# Uso: powershell -File narrar.ps1 <falas.json> <pasta de saida>
param([string]$Falas, [string]$Saida)

Add-Type -AssemblyName System.Speech
$voz = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voz.SelectVoice('Microsoft Maria Desktop')
$voz.Rate = 2
$formato = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)

$lista = Get-Content -Raw -Encoding UTF8 $Falas | ConvertFrom-Json
foreach ($c in $lista) {
  $voz.SetOutputToWaveFile((Join-Path $Saida "$($c.id).wav"), $formato)
  $voz.Speak($c.fala)
}
$voz.SetOutputToNull()
$voz.Dispose()
