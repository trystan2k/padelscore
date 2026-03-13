## What
The Zepp OS 3+ migration will target a minimum supported API_LEVEL of `3.6`.

## Why
The user selected support policy option 2 (`3.6+`) to balance modern device coverage with a smaller compatibility and layout matrix.

## Where
Affects `app.json` runtime `apiVersion.minVersion`, the supported device matrix, allowed API usage without fallbacks, and QA/device verification scope.

## Learned
This keeps key modern screen families in scope (`w390` square, `w454`/`w466`/`w480` round) while excluding lower-end older modern devices like `w320` square and API 3.0/3.5 devices.