# SSH Dashboard
 
Live status dashboard for lab machines (CPU, RAM, disk, SSH sessions). Each machine pushes its own metrics to a central collector; the web page polls the collector.
 
```
lab PCs (monitor.sh) --POST /report--> server.py --GET /api/machines--> Web Interface
        ^
        |  deployed over SSH by deploy-monitors.sh (host1/2/3)
```
 
## Code organization
 
```
SSH-Dashboard/
├── Backend/
│   ├── server.py            # Central collector (stdlib HTTP server, port 8000)
│   ├── monitor.sh           # Agent running on each lab PC
│   ├── deploy-monitors.sh   # Launcher: pushes and starts monitor.sh on a lab's PCs
│   └── host1, host2, host3  # Host lists (user@hostname), one per lab
└── Dashboard/Web Interface/
    ├── index.html           # Page structure (home, lab view, machine list)
    ├── app.js               # Fetches /api/machines every 30s, renders seat map and table
    ├── styles.css           # Styling
    └── images/PC.png        # Machine icon
```
 
## Role of each file
 
| File | Role |
|---|---|
| `server.py` | `POST /report` validates and stores one report per machine in `reports/`; `GET /api/machines` returns all current machines. Rejects stale or duplicate reports and deletes machines silent for 5 min. |
| `monitor.sh` | Every 30s, measures CPU %, memory, disk and SSH sessions, then POSTs one `key=value` line to the server. Set `SERVER_IP` before deploying. |
| `deploy-monitors.sh` | Asks for a lab (1/2/3) and the SSH password, copies `monitor.sh` to each host and runs it. Keep the terminal open; Ctrl+C stops all monitors. |
| `host1/2/3` | Machine lists for Software Labs 1, 2 and 3. |
| `index.html` / `app.js` / `styles.css` | Dashboard UI: per-lab seat map, plus a searchable, sortable, paginated machine table. |


## Commands

Terminal 1: copies the server.py to the central machine and starts the script

   scp server.py labuser@CENTRAL_IP:/home/labuser/
   EX : scp server.py labuser@sl2-1.cse.iitb.ac.in:/home/labuser/

   ssh labuser@CENTRAL_IP
   EX : ssh labuser@sl2-1.cse.iitb.ac.in

   python3 server.py

Terminal 2: enables the ssh tunnel for transferring the report from server to local machine 

   ssh -N -o ExitOnForwardFailure=yes   -L 127.0.0.1:8000:127.0.0.1:8000    labuser@CENTRAL_IP
   EX : ssh -N -o ExitOnForwardFailure=yes   -L 127.0.0.1:8000:127.0.0.1:8000   labuser@10.130.154.1

Terminal 3: copies monitor.sh to all the machines and starts the script

   ./deploy-monitor.sh

Terminal 4: bind the port to render the frontend data

   python3 -m http.server 5500 --bind 127.0.0.1
