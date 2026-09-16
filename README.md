# my-unn-quiz-app

UNN computer-based testing and quiz competition portal.

## Local development

The application runs as a single local backend/frontend process on port 3000:

```text
http://localhost:3000
```

Start it with:

```bash
npm run dev
```

The Express backend exposes the JSON storage API under `/api/storage/*`. Persistent
application data is organized in `server/data/` as:

- `students.json`
- `courses.json`
- `quizzes.json`
- `attempts.json`
- `results.json`
- `notifications.json`
- `config.json`

The files are created from the seed data automatically on first startup. The browser
keeps a local cache for the existing synchronous UI and mirrors changes to these
backend files through the API.

Live changes are broadcast over `ws://localhost:3000/ws`. Saves and deletes replace
the complete JSON resource atomically, then notify every connected browser so lists
update in place without a page reload.
