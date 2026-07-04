# start.ps1

Write-Host "Starting Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\venv\Scripts\python.exe app.py" -WorkingDirectory "$PWD\backend"

Write-Host "Starting Frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WorkingDirectory "$PWD\frontend"

Write-Host "Both services are starting up!" -ForegroundColor Green
