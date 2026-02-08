---
name: shell-bg
description: Smart background process detection for run_shell_command - prevents long-running services from blocking the conversation.
---

# Shell Background Process Skill

When using `run_shell_command`, you MUST classify the command before execution.

## Command Classification

### Foreground (execute normally)

Commands that process data and exit:

- Build: `npm run build`, `make`, `gcc`, `tsc`, `cargo build`
- Test: `npm test`, `pytest`, `jest`, `go test`
- Script: `node script.js`, `python process.py` (data processing scripts)
- File ops: `cp`, `mv`, `rm`, `find`, `grep`, `cat`, `ls`
- Package: `npm install`, `pip install`, `apt install`
- Git: `git clone`, `git pull`, `git commit`

### Background (MUST add `&`)

Commands that start a long-running service or daemon:

- Dev servers: `npm run dev`, `npm start`, `npm run serve`, `yarn dev`, `npx vite`, `npx next dev`
- Node servers: `node server.js`, `node app.js`, `node index.js` (when context indicates a server)
- Python servers: `python manage.py runserver`, `python -m http.server`, `flask run`, `uvicorn`, `gunicorn`
- Java: `java -jar *.jar` (servers), `mvn spring-boot:run`, `gradle bootRun`
- Docker: `docker run` (without `-d`), `docker compose up` (without `-d`)
- Watchers: `npm run watch`, `nodemon`, `tsc --watch`, `webpack --watch`
- Other: `redis-server`, `mongod`, `nginx`, `caddy run`

### Uncertain → ASK the user

If you cannot determine from context whether the command is foreground or background:

> This command (`xxx`) might be a long-running process. Should I run it in the background?
>
> - **Background** (recommended for servers/daemons): The process runs independently, and we can continue our conversation
> - **Foreground**: Wait for the command to complete before continuing

## Background Execution Format

When running a background command, transform it:

```
Original:  npm run dev
Execute:   npm run dev > /dev/null 2>&1 &
           BG_PID=$!
           sleep 8
           echo ""
           echo "✓ Process started in background (PID: $BG_PID)"
           echo "  To stop: kill $BG_PID"
```

Key rules:

1. Redirect output to `/dev/null` to prevent the shell tool from accumulating output
2. `&` to background the process
3. `sleep 8` to allow the process to start and detect early failures
4. Report the PID so the user can manage the process later

If the user needs to see startup output (e.g., to verify the server started correctly):

```
Original:  npm run dev
Execute:   npm run dev &
           BG_PID=$!
           sleep 8
           echo ""
           echo "✓ Process started in background (PID: $BG_PID)"
           echo "  To stop: kill $BG_PID"
```

(Without `/dev/null` redirect, the first 8 seconds of output will be captured)

## Context Memory

- If the user tells you a specific program is a background service, remember it for the rest of the conversation
- If the user previously answered "foreground" for a program, don't ask again for the same program
- Use conversation context to infer: "start the server" → background; "run the migration" → foreground

## Process Management

When asked to stop a background process:

```bash
kill <PID>
```

When asked to check if a process is running:

```bash
ps -p <PID> -o pid,command 2>/dev/null || echo "Process not running"
```

## IMPORTANT

- **NEVER** run a server/daemon command without `&`. It will block the entire conversation indefinitely.
- When in doubt, ASK the user. A 5-second question is better than a frozen conversation.
- The `sleep` duration (default 8s) can be adjusted: use longer (15s) for slow-starting services like Java, shorter (3s) for simple servers.
