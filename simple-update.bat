@echo off
plink -ssh root@64.188.70.12 -pw Gamemode1 -batch "cd /root/Xpanel && git pull origin main"
pause
