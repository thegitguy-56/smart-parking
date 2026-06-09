$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location $scriptDir

# Create virtual environment if missing
if (-not (Test-Path ".venv")) {
    python -m venv .venv
}

# Use the venv's python to install dependencies and run the server
$venvPython = Join-Path $scriptDir ".venv\Scripts\python.exe"
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r requirements.txt

# Start the FastAPI app with uvicorn (serves from this directory)
& $venvPython -m uvicorn api.main:app --reload --port 8000 --app-dir .

Pop-Location
