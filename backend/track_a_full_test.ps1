# ============================================
# Track A -- Full Verification Test Suite
# Run this after: uvicorn main:app --reload --port 8000
# ============================================

Write-Host "`n=== TEST 1: norad_id validation ===" -ForegroundColor Cyan
Write-Host "Valid (should be 200):"
curl.exe -s -o NUL -w "%{http_code}`n" "http://127.0.0.1:8000/predict?norad_id=25544&hours=1&step_s=300"
Write-Host "Invalid (should be 404):"
curl.exe -s "http://127.0.0.1:8000/predict?norad_id=99999"
Write-Host ""

Write-Host "`n=== TEST 2: Anomaly scenario flag counts ===" -ForegroundColor Cyan
Write-Host "Expected: nominal=0, spike>0, drift>0, fault>0 (all clearly nonzero except nominal)"
foreach ($s in @("nominal","spike","drift","fault")) {
    $data = Invoke-RestMethod "http://127.0.0.1:8000/anomaly?norad_id=25544&start=2026-08-15T18:00:00Z&hours=3&step_s=60&scenario=$s"
    $flagged = ($data | Where-Object { $_.flagged -eq $true }).Count
    Write-Host "$s : $flagged / $($data.Count) flagged"
}

Write-Host "`n=== TEST 3: Nominal stability across different windows ===" -ForegroundColor Cyan
Write-Host "Expected: 0 or very close to 0 across all windows (occasional 1 on long windows is statistically normal)"
$windows = @(
    @{start="2026-08-15T18:00:00Z"; hours=3; step=60},
    @{start="2026-08-16T00:00:00Z"; hours=3; step=60},
    @{start="2026-08-17T12:00:00Z"; hours=2; step=60},
    @{start="2026-08-18T03:15:00Z"; hours=6; step=60}
)
foreach ($w in $windows) {
    $data = Invoke-RestMethod "http://127.0.0.1:8000/anomaly?norad_id=25544&start=$($w.start)&hours=$($w.hours)&step_s=$($w.step)&scenario=nominal"
    $flagged = ($data | Where-Object { $_.flagged -eq $true }).Count
    Write-Host "start=$($w.start) hours=$($w.hours) -> $flagged / $($data.Count) flagged"
}

Write-Host "`n=== TEST 4: /explain error handling ===" -ForegroundColor Cyan
Write-Host "All should return 422 (clean validation error, not a crash):"
Write-Host "-- empty window --"
curl.exe -s -w "`nHTTP %{http_code}`n" -X POST "http://127.0.0.1:8000/explain" -H "Content-Type: application/json" -d '{\"window\": [], \"subsystem\": \"thermal_panel_a\"}'
Write-Host "-- missing window key --"
curl.exe -s -w "`nHTTP %{http_code}`n" -X POST "http://127.0.0.1:8000/explain" -H "Content-Type: application/json" -d '{\"subsystem\": \"thermal_panel_a\"}'

Write-Host "`n=== TEST 5: Contract shape spot-check ===" -ForegroundColor Cyan
Write-Host "Confirm /predict returns t, sun_angle_deg, eclipse, predicted_c:"
(Invoke-RestMethod "http://127.0.0.1:8000/predict?norad_id=25544&hours=1&step_s=300")[0]

Write-Host "`n=== DONE - review results above ===" -ForegroundColor Green