#!/bin/bash

SERVER_IP="0.0.0.0" # central server ip address
SERVER_PORT=8000
INTERVAL=10

HOST=$(hostname)
LOG_FILE="monitor_output.log"
MAX_LINES=1000
COUNT=0

echo "Monitoring started on $HOST"

while true
do
    read -r _ user nice system idle iowait irq softirq steal rest < /proc/stat
    idle1=$((idle + iowait))
    total1=$((user + nice + system + idle + iowait + irq + softirq + steal))

    sleep 1

    read -r _ user nice system idle iowait irq softirq steal rest < /proc/stat
    idle2=$((idle + iowait))
    total2=$((user + nice + system + idle + iowait + irq + softirq + steal))

    delta_total=$((total2 - total1))
    delta_idle=$((idle2 - idle1))

    CPU=$(awk -v t="$delta_total" -v i="$delta_idle" \
        'BEGIN {if (t > 0) printf "%.2f", 100*(t-i)/t; else print "0.00"}')

    read -r TOTAL AVAILABLE < <(
        awk '
          /^MemTotal:/ {total=$2}
          /^MemAvailable:/ {available=$2}
          END {print total, available}
        ' /proc/meminfo
    )

    MEM=$(awk -v t="$TOTAL" -v a="$AVAILABLE" \
        'BEGIN {printf "%.2f", 100*(t-a)/t}')

    
    RAM_TOTAL_MB=$((TOTAL / 1024))
    RAM_AVAILABLE_MB=$((AVAILABLE / 1024))


    
    SSH_SESSIONS=$(ss -Htn state established '( sport = :22 )' 2>/dev/null | wc -l)


    REPORT="host=$HOST cpu=$CPU mem=$MEM ram_total_mb=$RAM_TOTAL_MB ram_available_mb=$RAM_AVAILABLE_MB ssh_sessions=$SSH_SESSIONS"

    echo "$REPORT"

    RESPONSE=$(curl -sS --max-time 3 \
        -X POST \
        --data-binary "$REPORT" \
        "http://$SERVER_IP:$SERVER_PORT/report" 2>&1)

    echo "$(date '+%F %T') $REPORT response=$RESPONSE" >> "$LOG_FILE"

    COUNT=$((COUNT + 1))

    # Cleanup after every 100 reports
    if (( COUNT % 100 == 0 )); then
        tail -n "$MAX_LINES" "$LOG_FILE" > "$LOG_FILE.tmp"
        mv "$LOG_FILE.tmp" "$LOG_FILE"
    fi

    sleep "$INTERVAL"
done