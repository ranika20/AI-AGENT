# AI Troubleshooting Agent

English version

A small Express-based demo that simulates an application with different runtime faults and a two-agent investigation flow. The system inspects service health, logs, and version information, diagnoses the issue, and recommends the next operational action.

## Features

- Simulated target service with multiple runtime scenarios:
  - `normal`
  - `db_down`
  - `slow`
  - `timeout`
- Two-agent investigation flow:
  - Agent 1: investigates the evidence and identifies the issue
  - Agent 2: reviews the diagnosis and recommends the next action
- Investigation endpoint that checks:
  - `/service/health`
  - `/service/logs`
  - `/service/version`
- Simple HTML UI with a Hebrew interface
- Fallback diagnostics when no external model key is configured
- Optional Gemini integration via `GOOGLE_API_KEY` or `GEMINI_API_KEY`

## Project structure

The project is split into a clear frontend/backend architecture:

```text
AI-AGENT/
├── frontend/
│   ├── public/
│   ├── package.json
│   ├── server.js
│   └── Dockerfile
├── backend/
│   ├── app.js
│   ├── server.js
│   ├── package.json
│   ├── agents/
│   │   ├── investigationAgent.js
│   │   └── decisionAgent.js
│   ├── routes/
│   │   ├── configRoutes.js
│   │   ├── serviceRoutes.js
│   │   └── investigationRoutes.js
│   ├── services/
│   │   └── serviceSimulator.js
│   └── Dockerfile
├── compose.yaml
├── README.md
└── .gitignore
```

### Architecture

- Frontend: serves the UI and calls the backend API
- Backend: exposes the API and runs the troubleshooting logic
- Routes: handle HTTP requests
- Services: simulate the health and runtime behavior of the target system
- Agents:
  - Investigation Agent: analyzes logs, health, and service status
  - Decision Agent: interprets the diagnosis and returns the recommended action

## Run the app

1. Install dependencies for each service:

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. Start the backend:

   ```bash
   cd backend && npm start
   ```

3. Start the frontend:

   ```bash
   cd frontend && npm start
   ```

4. Open:

   ```text
   http://localhost:3000
   ```

## Run with Docker

From the project root:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:3000
```

The frontend runs on port 3000 and communicates with the backend on port 3001.

## API endpoints

- `GET /api/scenarios` — returns available runtime modes
- `POST /api/scenario` — sets the current runtime mode
- `POST /api/provider-key` — saves or clears the Gemini key
- `GET /api/config` — returns current config and provider status
- `POST /api/investigate` — runs the investigation flow
- `GET /service/health` — service health check
- `GET /service/logs` — structured service logs
- `GET /service/version` — application version

## Model configuration

You can enable Gemini by defining an API key in `.env` or via the UI:

```env
GOOGLE_API_KEY=your_key_here
```

If no key is present, the app falls back to a deterministic rule-based diagnosis.

## Demo flow

1. Pick a scenario from the dropdown
2. Click the investigation button
3. The app collects evidence from the service
4. The investigation agent diagnoses the issue
5. The decision agent recommends the next step

## Notes

- Secrets are kept in environment variables or runtime memory, not hardcoded
- The agent operates only on tool output, not on the source code itself
- The project is intentionally lightweight and designed as a clear demonstration of troubleshooting logic

---

עברית

# AI Troubleshooting Agent

יישום קטן המבוסס על Express שמדמה מערכת עם מצבי ביצוע שונים ומבצע תהליך חקירה באמצעות שני סוכנים. המערכת בודקת את מצב השירות, הלוגים וגרסת האפליקציה, מזהה את התקלה, וממליצה על הפעולה הבאה.

## תכונות

- שירות מטרה מדומה עם מצבים שונים:
  - `normal`
  - `db_down`
  - `slow`
  - `timeout`
- תהליך חקירה באמצעות שני סוכנים:
  - סוכן 1: אוסף ראיות ומזהה את התקלה
  - סוכן 2: בוחן את האבחנה וממליץ על הפעולה הבאה
- נקודת גישה לחקירה שמבדקת:
  - `/service/health`
  - `/service/logs`
  - `/service/version`
- ממשק HTML פשוט עם ממשק בעברית
- אבחנה מקומית כאשר אין מפתח מודל מוגדר
- אינטגרציה אופציונלית עם Gemini דרך `GOOGLE_API_KEY` או `GEMINI_API_KEY`

## מבנה הפרויקט

הפרויקט מחולק למבנה ברור של Frontend ו-Backend:

```text
AI-AGENT/
├── frontend/
│   ├── public/
│   ├── package.json
│   ├── server.js
│   └── Dockerfile
├── backend/
│   ├── app.js
│   ├── server.js
│   ├── package.json
│   ├── agents/
│   │   ├── investigationAgent.js
│   │   └── decisionAgent.js
│   ├── routes/
│   │   ├── configRoutes.js
│   │   ├── serviceRoutes.js
│   │   └── investigationRoutes.js
│   ├── services/
│   │   └── serviceSimulator.js
│   └── Dockerfile
├── compose.yaml
├── README.md
└── .gitignore
```

### ארכיטקטורה

- Frontend: מספק את ממשק המשתמש ומבצע קריאות ל-API
- Backend: מעבד את ה-API ומבצע את לוגיקת פתרון הבעיות
- Routes: מטפל בבקשות HTTP
- Services: מדמים את מצבו של השירות בזמן אמת
- Agents:
  - Investigation Agent: מנתח לוגים, מצב שירות וגרסה
  - Decision Agent: מפרש את האבחנה ומחזיר המלצה לפעולה

## הרצת האפליקציה

1. התקן תלויות לכל שירות:

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. הפעל את ה-Backend:

   ```bash
   cd backend && npm start
   ```

3. הפעל את ה-Frontend:

   ```bash
   cd frontend && npm start
   ```

4. פתח:

   ```text
   http://localhost:3000
   ```

## הרצה עם Docker

מהשורת הפקודה של הפרויקט:

```bash
docker compose up --build
```

ואז פתח:

```text
http://localhost:3000
```

ה-Frontend רץ על port 3000 וה-Backend מתקשר אליו ב-port 3001.

## נקודות API

- `GET /api/scenarios` — מחזיר את מצבי הזמן המופעלים
- `POST /api/scenario` — משנה את המצב הנוכחי
- `POST /api/provider-key` — שומר או מנקה את מפתח Gemini
- `GET /api/config` — מחזיר את התצורה הנוכחית ואת מצב הספק
- `POST /api/investigate` — מפעיל את תהליך החקירה
- `GET /service/health` — בדיקת מצב שירות
- `GET /service/logs` — לוגים של השירות בפורמט מבני
- `GET /service/version` — גרסת האפליקציה

## תצורת המודל

אפשר להפעיל Gemini באמצעות מפתח API ב-`.env` או דרך הממשק:

```env
GOOGLE_API_KEY=your_key_here
```

אם אין מפתח, האפליקציה עוברת ל-AI fallback מבוסס על כללי קביעה סטטיים.

## תהליך הדגמה

1. בחר מצב מה-dropdown
2. לחץ על כפתור החקירה
3. האפליקציה אוספת ראיות מהשירות
4. סוכן החקירה מאבחן את הבעיה
5. סוכן ההחלטה ממליץ על הפעולה הבאה

## הערות

- סודות נשמרים במשתני סביבה או בזיכרון בזמן ריצה, ולא מקודדים בקוד
- הסוכן עובד רק על פלטים של הכלים, ולא על קוד המקור עצמו
- הפרויקט נבנה במכוון כ-demo קליל, במטרה להמחיש את לוגיקת פתרון הבעיות
