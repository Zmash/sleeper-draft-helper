# Architecture Overview

```mermaid
flowchart TD
  A[index.html + main.jsx] --> B(App.jsx)
  B -- state/handlers --> C[SetupPage]
  B -- filtered data --> D[BoardPage]
  B -- picks/me --> E[RosterPage]

  B <-- hooks/services --> S[services/* + hooks/*]
  C -. calls .-> S
  D -. calls .-> S

  subgraph components
    P[PlayersTable] --> D
    R[RosterList] --> E
    T[TopBar] --> B
    N[TabNavigation] --> B
    G[ProgressBar] --> D
  end
```

- **App.jsx** orchestrates global state and effects.
- **Pages** are presentational; they receive state + handlers via props.
- **Services** encapsulate network/storage/CSV logic.
- **Components** are stateless UI building blocks.
