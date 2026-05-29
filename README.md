# Claude Token Monitor

Lokalny dashboard do monitorowania **zużycia tokenów Claude Code** na danej
maszynie. Czyta dane z lokalnych logów Claude Code (`~/.claude/projects/**/*.jsonl`)
— bez płatnego API, bez uprawnień admina, wszystko zostaje na Twoim komputerze.

Założenie: na danej maszynie podpięte jest zwykle **jedno konto** (np. służbowe na
laptopie firmowym), więc liczone jest **łączne** zużycie tego konta — bez podziału
prywatne/firmowe.

Frontend: **React + TypeScript** (Vite), motyw przez **React Context**, wykresy
na **Recharts**. Trzy motywy: jasny, ciemny (pastelowy szary) i neon (cyberpunk).

## Architektura

Przeglądarka nie czyta plików z dysku, więc aplikacja ma dwie części:

- **Backend** (`server.js`, Node + Express) — skanuje `~/.claude/projects`,
  sumuje tokeny z pola `message.usage` oraz ich **koszt-ekwiwalent** (wagi cenowe
  per model i typ tokenu), liczy zużycie w oknach czasowych i wystawia
  `GET /api/snapshot`, `POST /api/calibrate`, `POST /api/exclude`. Skanuje
  przyrostowo (po czasie modyfikacji plików), więc nowe sesje pojawiają się
  niemal na żywo.
- **Frontend** (`src/`, React/TS) — odpytuje `/api/snapshot` co 5 s i rysuje
  wskaźniki %, wykresy oraz tabelę projektów.

## Wymagania

- Node.js 18+ (testowane na 22)
- Używasz Claude Code (logi w `~/.claude/projects`)

## Uruchomienie (jedną komendą)

```bash
./start.sh          # zainstaluje (jeśli trzeba), zbuduje frontend i uruchomi serwer
```

…albo równoważnie przez npm:

```bash
npm install         # tylko za pierwszym razem
npm run serve       # = npm run build && npm start
```

Otwórz **http://localhost:4000**. (Port zmienisz przez `PORT=5000 ./start.sh`.)

## Uruchomienie bez klonowania (npx)

Aplikacja jest opublikowana na npm — uruchomisz ją bez klonowania:

```bash
npx claude-code-usage-dashboard
```

Pierwsze uruchomienie pobiera zależności (kilka sekund) — poczekaj, aż w terminalu
pojawi się linia `Dashboard: http://localhost:4000`, i dopiero wtedy otwórz
przeglądarkę. Zbudowany frontend (`dist/`) jest dołączony do paczki, więc nic się
nie buduje przy instalacji (szybko i niezawodnie).

> **Nie używaj `npx github:…`** — na npm 9.x z Debiana/Ubuntu ta ścieżka jest
> popsuta (bug npm w obsłudze zależności git: „could not determine executable to
> run"). Dlatego dystrybucja idzie przez rejestr npm.

Kalibracja i wykluczenia zapisują się w `~/.claude-usage-dashboard.json`, więc
przeżywają kolejne uruchomienia (także przez `npx`, który działa w katalogu
tymczasowym). Logi czytane są z `~/.claude` na **tej** maszynie — aplikacja musi
działać lokalnie, na koncie którego zużycie chcesz widzieć.

### Publikacja nowej wersji (dla utrzymującego)

```bash
npm version patch        # podbij wersję
npm publish              # prepublishOnly samo zbuduje świeży dist/
```

> Po zmianach frontendu pamiętaj o `npm run build` i commicie `dist/` (jest w repo),
> żeby uruchomienia z gita/lokalne też miały aktualny UI.

## Tryb developerski (hot reload)

W dwóch terminalach:

```bash
npm run server     # backend na :4000
npm run dev        # Vite na :5173 (proxy /api -> :4000)
```

Otwórz http://localhost:5173.

## % zużycia — jak to liczymy (kalibracja)

**W logach nie ma limitu planu** — limity Claude są egzekwowane po stronie serwera
i nie trafiają do plików `.jsonl`. Strona „Usage" w ustawieniach konta też nie liczy
surowych tokenów: waży je wewnętrznie (Opus „kosztuje" dużo więcej niż Sonnet,
output więcej niż input, cache-read jest groszowy) i pokazuje % limitu w oknach
czasowych. Dlatego, żeby zbliżyć się do tej liczby z samego dysku, robimy trzy rzeczy:

1. **Ważenie kosztem.** Każdy typ tokenu mnożymy przez cenę API danego modelu
   (tabela `PRICING` w `server.js`). Dzięki temu proporcje między modelami zgadzają
   się z ustawieniami — surowa suma tokenów zupełnie by tu kłamała.
2. **Te same okna co ustawienia.** Kroczące **5 h** („sesja", w blokach startujących
   od pierwszej wiadomości, z czasem do resetu) oraz **ostatnie 7 dni** („tydzień").
3. **Jednorazowa kalibracja.** Patrzysz w ustawienia (np. „tydzień: 47%"), klikasz
   **Kalibruj** przy danym wskaźniku i wpisujesz `47`. Backend wylicza limit wstecz
   (`limit = koszt_w_oknie / (% / 100)`) i zapisuje go w `dashboard-config.json`.
   Od tej chwili wskaźnik trzyma się blisko, bo używa tych samych okien i wag.

> **Dokładność cen nie musi być idealna** — wspólny mnożnik skraca się przy
> kalibracji, liczy się tylko *proporcja* kosztu między modelami/typami tokenów.

**Czego to nie zrobi:** co do procenta identycznie nie będzie — dokładny wzór wag
Anthropic nie jest publiczny, okno „tygodniowe" w ustawieniach ma stały punkt resetu
(my liczymy kroczące 7 dni), a ustawienia mogą wliczać też czat Claude.ai (Pro),
którego na dysku nie ma. To najbliższe możliwe z samego dysku.

## Wykluczanie projektów

W tabeli **Projekty** każdy katalog roboczy ma przełącznik **Liczony / Pomijany**.
Pomiń szum (np. sam ten dashboard, repo testowe), żeby nie zawyżał totali i nie
psuł kalibracji. Wybór zapisuje się w `dashboard-config.json`.

## Co pokazuje

- Dwa wskaźniki **% zużycia**: sesja (5 h, z czasem do resetu) i tydzień (7 dni).
- Wykres tokenów w czasie z rozbiciem na input / output / cache read / cache write.
- Strukturę tokenów w % oraz koszt-ekwiwalent wg modelu.
- Tabelę projektów z sumami tokenów, kosztem i przełącznikiem liczenia.
- Tabelę **sesji** (jak `/resume`) — tytuł, projekt, ile tokenów i kosztu „zjadła"
  każda sesja; sortowanie po ostatniej aktywności lub po tokenach.

Liczone są **tokeny** i ich **koszt-ekwiwalent** (wagi do %), nie faktyczna faktura —
przy korzystaniu z Claude Code w ramach subskrypcji koszt nie jest naliczany per token.
Zużycie czatu Claude.ai (Pro) **nie** jest tu uwzględnione — nie ma do niego lokalnych
logów ani API.

## Zmienne środowiskowe

| Zmienna | Domyślnie | Opis |
|---|---|---|
| `PORT` | `4000` | port backendu |
| `SCAN_INTERVAL_MS` | `8000` | jak często skanować logi |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | katalog danych Claude Code |
| `DASHBOARD_CONFIG` | `~/.claude-usage-dashboard.json` | plik z kalibracją i wykluczeniami |

## Struktura

```
server.js              backend: czytnik logów + wagi kosztu + okna + API
src/
  App.tsx              układ
  theme/ThemeContext.tsx   React Context motywu (light/dark/neon)
  theme/palette.ts     kolory wykresów + progi wskaźników per motyw
  hooks/useSnapshot.ts polling /api/snapshot
  lib/format.ts        formatowanie liczb / USD / % / odliczanie
  components/          UsageGauges, TokenAreaChart, BreakdownPanel,
                       ProjectTable, SessionTable, StatusBar, ThemeSwitcher
```
