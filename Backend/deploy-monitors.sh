#!/usr/bin/env bash
set -eu

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
monitor="$script_dir/monitor.sh"

printf '1) Software Lab 1 (host1)\n2) Software Lab 2 (host2)\n3) Software Lab 3 (host3)\n'
read -r -p 'Which lab? Enter 1, 2, or 3: ' selection
case "$selection" in
    1|host1) hosts_file="$script_dir/host1" ;;
    2|host2) hosts_file="$script_dir/host2" ;;
    3|host3) hosts_file="$script_dir/host3" ;;
    *) echo 'Choose 1, 2, or 3.' >&2; exit 2 ;;
esac

# Allow only one launcher per lab from this folder.
exec 8>"$hosts_file.deploy.lock"

if ! flock -n 8; then
    echo "This lab already has a launcher running."
    echo "Stop its existing terminal with Ctrl+C first."
    exit 1
fi

if [[ ! -r "$hosts_file" || ! -r "$monitor" ]]; then
    printf 'Put %s and monitor.sh next to this launcher.\n' "${hosts_file##*/}" >&2
    exit 1
fi
bash -n "$monitor"
if grep -Eq '^[[:space:]]*SERVER_IP="?0\.0\.0\.0"?([[:space:]]|$)' "$monitor"; then
    echo 'Set SERVER_IP in monitor.sh to the central lab collector before uploading.' >&2
    exit 1
fi
if ! command -v sshpass >/dev/null; then
    echo 'Install sshpass on your laptop to use password authentication.' >&2
    exit 1
fi
read -r -s -p 'Lab SSH password (used for all selected PCs): ' lab_password
printf '\n'
if [[ -z "$lab_password" ]]; then
    echo 'Enter the lab SSH password.' >&2
    exit 1
fi

mkdir -p "$script_dir/ssh-logs"
log_dir=$(mktemp -d "$script_dir/ssh-logs/run.XXXXXXXX")
upload_tag=${log_dir##*.}
control_dir=$(mktemp -d /tmp/lab-ssh.XXXXXXXX)
ssh_options=(-o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new)
ssh_pids=()

stop_sessions() {
    if (( ${#ssh_pids[@]} )); then
        kill "${ssh_pids[@]}" 2>/dev/null || true
        wait "${ssh_pids[@]}" 2>/dev/null || true
    fi
    local socket
    for socket in "$control_dir"/*; do
        if [[ -S "$socket" ]]; then
            ssh -F /dev/null -S "$socket" -O exit localhost >/dev/null 2>&1 || true
        fi
    done
    rm -rf -- "$control_dir"
}
trap stop_sessions EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

remote_start=$(cat <<'REMOTE'
cd "$HOME/ssh-dashboard" || exit 1
exec 9>".monitor-$(hostname).lock"
if ! /usr/bin/flock -n 9; then
    rm -f -- "$stage"
    echo 'Monitor already running under this lock.'
    exit 1
fi
mv -f -- "$stage" monitor.sh || exit 1
chmod +x monitor.sh || exit 1
exec /bin/bash ./monitor.sh
REMOTE
)

printf 'Per-host logs: %s\n' "$log_dir"
failures=0
host_index=0
while read -r host _ || [[ -n "$host" ]]; do
    host=${host%$'\r'}
    [[ -z "$host" || "$host" == \#* ]] && continue

    (( host_index += 1 ))
    stage=".monitor-upload-$upload_tag.$host_index"
    control_socket="$control_dir/$host_index"
    reuse_options=(-o BatchMode=yes -o ControlMaster=no -o "ControlPath=$control_socket")
    log="$log_dir/${host//[^a-zA-Z0-9_.@-]/_}.log"
    printf 'Uploading to %s\n' "$host"
    if sshpass -d 3 ssh -nT -M -S "$control_socket" "${ssh_options[@]}" \
           -o BatchMode=no -o ControlPersist=30 -o NumberOfPasswordPrompts=1 \
           -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
           -- "$host" 'mkdir -p "$HOME/ssh-dashboard"' 3<<< "$lab_password" >>"$log" 2>&1 &&
       scp -q "${ssh_options[@]}" "${reuse_options[@]}" -- "$monitor" "$host:ssh-dashboard/$stage" \
           </dev/null >>"$log" 2>&1
    then
        ssh -n -tt "${ssh_options[@]}" "${reuse_options[@]}" \
            -- "$host" "stage='$stage'; $remote_start" >>"$log" 2>&1 &
        ssh_pids+=("$!")
    else
        printf 'Upload failed on %s. See %s\n' "$host" "$log" >&2
        failures=1
    fi
done < "$hosts_file"
unset lab_password

if (( ${#ssh_pids[@]} == 0 )); then
    echo 'No monitor sessions were launched.' >&2
    exit 1
fi

printf 'Launched %d SSH sessions. Keep this terminal open. Ctrl+C closes them.\n' "${#ssh_pids[@]}"
for pid in "${ssh_pids[@]}"; do
    wait "$pid" || failures=1
done
if (( failures )); then
    printf 'One or more hosts reported errors. See %s\n' "$log_dir" >&2
fi
exit "$failures"
