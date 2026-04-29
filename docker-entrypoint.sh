#!/bin/sh
set -e

# Fix permissions on bind-mounted volumes (run as root before privilege drop)
mkdir -p /app/data /app/logs
chown imohuan:imohuan /app/data /app/logs

# Drop to non-root user and exec the main command
exec gosu imohuan "$@"
