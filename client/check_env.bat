@echo off
dir > output.txt 2>&1
call npm --version >> output.txt 2>&1
echo Done. >> output.txt 2>&1
