# Student Lab Machine Dashboard

A student-facing dashboard for viewing the status and basic resource usage of Linux lab machines. The first version collects information over SSH without requiring sudo access on the lab machines. 

## Features

- Show whether each machine is reachable.
- Display CPU load, core count, memory, and last check time.
- Show logged-in session count if institute policy allows it.
- Recommend a machine using transparent CPU and memory rules (planned).
- Provide browser-based SSH and file transfer (planned).

## Technology

- Python and FastAPI for the backend
- React for the frontend
- SQLite for the prototype database
- SSH for collecting machine information

## Getting Started

1. Select a few approved lab machines and record their hostnames/IP addresses and SSH ports.
2. Confirm that the computer running the backend can reach them over SSH.
3. Test these read-only commands on each machine:

   ```sh
   hostname
   getconf _NPROCESSORS_ONLN
   cat /proc/loadavg
   awk '/MemTotal|MemAvailable/ {print}' /proc/meminfo
   who
   ```

4. Implement an SSH collector that runs the commands, verifies host keys, and saves timestamped results.
5. Schedule collection every 30–60 seconds with connection timeouts and limited concurrency.
6. Display machine status, metrics, and the last check time in the dashboard.
7. Compare dashboard values with manual SSH checks and handle unreachable machines and stale data.

## Data Collected

- Machine reachability and check time
- Hostname and CPU core count
- CPU load average
- Total and available memory
- Logged-in user count, if permitted

## Security and Privacy

- Use read-only SSH checks; do not use sudo.
- Verify SSH host keys.
- Do not store student passwords in the application database.
- Confirm institute policy before collecting or displaying logged-in usernames.
- Run the backend on an institute-approved host that can access the lab network.

## Future Work

- Institute authentication and student identity mapping
- Rule-based machine recommendations based on CPU and memory requirements
- Browser SSH and SFTP file transfer
- Administrator-approved monitoring agents for more reliable metrics
- PostgreSQL and service discovery as usage grows