# Usage analytics, 2026-11-14

Julien wants to know who uses TV Scores and how: "I would like the most data
we can, to understand who are the users and how they use the app"
(2026-11-14). Until then the App Store version sent nothing about its
viewers, and the privacy page said so. Apple's own figures (App Store
Connect, App Analytics) only count the people who share analytics with
developers, and say nothing about pages or choices.

## What was chosen

**Amplitude** (Amplitude, Inc., in the United States), its Swift library in
the television's app and in the iPhone and iPad app. Compared on 2026-11-12
with TelemetryDeck, which anonymises on the device and keeps no address and
no user-level history; Julien wanted the person-level view, the city and the
address, which only Amplitude of the two gives. Julien signed up and sent the
key on 2026-11-14.

- **Free plan**: 2 million events a month, 10,000 session replays a month
  kept one month, a year of history to query (amplitude.com/pricing, read
  2026-11-14).
- **US data centre.** The key is accepted by `api2.amplitude.com` and refused
  by `api.eu.amplitude.com` (checked 2026-11-14): the project was made on the
  US site. Amplitude is self-certified under the EU-U.S. Data Privacy
  Framework (amplitude.com/security-and-privacy). To move to Europe: a new
  project at app.eu.amplitude.com, its key in `AMPLITUDE_KEY` and `EU` in
  `AMPLITUDE_ZONE` (`app/project.yml`); history does not move.
- **The key** is in `app/project.yml` and in both apps' Info.plist. It is not
  a secret: every app that uses Amplitude ships its own, and it only lets an
  app send events. It is the one exception to "the app talks only to the
  proxy", and the audit allows it in `app/Sources/Services/Analytics.swift`
  alone (`scripts/audit/secrets.mjs`).
- **Pinned exactly** in `app/project.yml`, with the two packages Amplitude's
  depends on, so a fresh resolution on the runner builds the same code:
  Amplitude-Swift 1.20.0 (2026-11-03), AmplitudeCore-Swift 1.6.1,
  analytics-connector-ios 1.3.3, and AmplitudeSessionReplay-iOS 0.18.1
  (2026-11-05; it requires AmplitudeCore 1.6.1, the one Amplitude-Swift
  1.20.0 uses, and iOS 13). Session Replay is a binary framework with no
  tvOS build: only the iPhone and iPad target links it.

## Consent

Apple's guideline 5.1.1(ii), as of 16 October 2026: "Apps that collect user
or usage data must secure user consent for the collection, even if such data
is considered to be anonymous at the time of or immediately following
collection. [...] Apps must also provide the customer with an easily
accessible and understandable way to withdraw consent." European law asks
the same of an identifier kept on a device.

- **The question** (`UsageQuestion`) comes once, over the front page, when
  the first board shows: "Help improve TV Scores?", Share or Don't Share. It
  names what goes, the IP address and the city, Amplitude, and on iPhone and
  iPad the recording of the screens.
- **Settings, Usage Data** shows the answer on the top list and opens
  a page of its own (`UsageChoiceSection`) to change it: On or Off on the
  television, with what sharing sends on the left, and a switch on a phone,
  with it underneath.
- **Nothing before a yes**: the Amplitude client is not even made, so it
  stores nothing on the device. A no, or Off later, stops sending at once
  (`optOut`), stops the iPhone's and iPad's recording, and resets the random
  number, so what came before stays apart from any later yes.
- **Never from the simulator**: CI runs the app against the live proxy on
  every push, and the flows answer the question. The simulator is not asked
  unless a launch says `-TVScoresAskConsent` (the flow and the screenshots),
  and it never sends, even after a yes (`Analytics.isSimulator`, checked by
  `UsageTests`). `-TVScoresReset` forgets the answer, as it forgets the
  competitions chosen.

## What is sent, after a yes

Every event carries what Amplitude's library adds: the app's version, the
system's name and version, the device's model, the platform, the language,
a random number per install (not Apple's vendor identifier), the session,
and the address the event comes from, from which Amplitude works out the
country, region and city (MaxMind) and which it keeps. No carrier.

Sessions and their length, installs, updates, openings and goings to the
background come from the library (`autocapture`: sessions and app
lifecycles; no UIKit screen views or taps, which would guess at SwiftUI).
The rest is ours (`UsageEvent`):

| Event | Properties |
|---|---|
| Page Viewed, Page Left | the page (home, competition, game, race, settings) with its day, competition, sport, sides or Settings page; Page Left adds the seconds on it. A page counts only while in sight (`PageClock`): not under a game, a race or Settings, not under a page pushed over it, not in the background, not before the yes; another day is another page, a game's state moving on is not |
| Menu Opened, Menu Closed | the television's menu panel |
| Competition Opened | the competition, its sport, the day, and from where (menu or home); picking the one already shown is not an opening |
| Game Opened, Race Opened | sport, competition, state, the two sides or the Grand Prix, from where (home or competition) |
| Day Picked | the day, and on which page |
| Watch App Tapped | the app chosen under How to Watch and the country: never whether it opened |
| Setting Changed | the setting, the item, before and after: a competition shown or hidden or moved, the countries, an app, the language |
| Board Shown | seconds from launch to the first board |
| Board Failed, Board Stale | the error, whether a board was on screen; a source behind |
| Sharing Started | the yes, from the question or from Settings |

The user properties (`UsageProfile`), sent with each yes (after Off and On,
under the new random number) once the first board has named the
competitions, and again after any change: the kind of device (tv, phone, pad), the edition (tester or store),
the language chosen in Settings and the device's own, the locale, region and
time zone, the competitions shown in the menu's order and those hidden, how
many are followed, the countries chosen, the apps hidden, and when the yes
was given.

**Session Replay**, on iPhone and iPad only: every visit recorded (the
plugin's default rate is none; ours is 1.0), at Amplitude's default masking,
with Amplitude's remote settings off so that the rate is the one in the code.
The television has no replay, and none exists for tvOS.

Nothing else changes what the app's own server sees or keeps: the proxy
still keeps nothing about who asks.

### Never sent

- No name, no email: the app has no account.
- No advertising identifier and no App Tracking Transparency: tracking in
  Apple's sense is for advertising, and none is done.
- Whether another app opened or is installed: Apple's 5.1.2(iv) forbids
  collecting "which other apps are installed on a user's device for the
  purposes of analytics". The app has no `canOpenURL`; How to Watch's tap is
  counted before the app is tried, and its outcome never is.
- **Advertising** is not part of this work: ads in the app, or the
  advertising identifier with App Tracking Transparency, are Julien's to
  decide later ("We will see for advertising later", 2026-11-14). The
  privacy page keeps "no ads".

## The address

Kept (Julien, 2026-11-14): the library sends the event's address for
Amplitude to read, which keeps it and fills the city. To keep the city
without the address, ask Amplitude Support (gethelp.amplitude.com) to drop
addresses after ingestion; turning the address off in the library
(`disableTrackIpAddress`) would empty the location fields as well
(amplitude.com/docs/data/understand-ip-address-and-location, 2026-11-10).

## The server's totals, for everyone (2026-11-15)

Amplitude sees only the viewers who say yes, and only from version 1.1. Julien
asked whether the back end could count too ("Is it possible to do some
analytics on the back end"), and said "Build it, but without the Pi backup"
(2026-11-15). The proxy counts the requests every copy of the app already
makes, whatever its version and its answer (`proxy/src/audience.js`):

- **What**: per UTC day, the devices that asked for the board, the sittings
  (board requests less than 10 minutes apart; the app asks every 3 minutes,
  every 30 s during a game) and the minutes they add up to, the hours with
  the app open, and per device and day its kind (`X-TVScores-Platform`, sent
  by builds after 51), app build, country (Cloudflare's `CF-IPCountry`), time
  zone and language; and how many devices opened each competition's table and
  each sport's game pages, and how often.
- **Not who.** Within a day a device is a keyed hash of its address, user
  agent (app build and system version), language and kind of device. The key is random, held in memory only, and dropped with
  the day's table when the day closes. Only totals reach the disk, one file a
  day in `~/.local/state/tvscores/audience/`, kept for good and **not backed
  up** (Julien's choice). A restart makes a new key: the day carries the totals
  counted before it, and a device seen on both sides counts twice
  (`restarts`). CI's builds (build 1), browsers and the machine's own calls are
  not counted.
- **Where Julien reads it**: `https://srv1822832.tailf78112.ts.net:8448/`,
  tailnet only (`tailscale serve` to the proxy's second port, 127.0.0.1:8789;
  `~/VPS.md`): the last 30 days, and the last 7 broken down, hours in São Paulo
  time.
- **No question needed**: nothing in it can name or follow a person, and the
  privacy pages say what is counted. App Privacy needs no new answer: the
  usage data is declared already, for Amplitude.

### Crossed with Amplitude, in totals (2026-11-15)

Julien: "Try to cross with amplitude" (he uses a VPN, and was seen in Brazil
and France). The page sets Amplitude's daily count of users who said yes, and
its countries over 7 days, beside the server's devices (`proxy/src/amplitude.js`,
Amplitude's Dashboard REST API, asked when the page opens and kept 10 min). Only
totals: matching device by device would need an identifier the server does not
keep, and would follow the viewers who said no. The key and the secret key are
in `~/.config/tvscores/amplitude.key` and `amplitude.secret` (600), never in the
repo. The page also counts the devices on the App Store build alone
(`STORE_BUILDS` in `proxy/src/audience-page.js`: add a build when it ships), so
test copies, Julien's among them, stand apart.

A VPN switched within a day makes the server count the device twice; Amplitude,
which follows its random number, counts it once and lists both countries.

## Apple's App Privacy form

To fill in App Store Connect, App Privacy, before the version that carries
this is submitted. One form covers the television's app and the iPhone and
iPad app. Today it says "Data Not Collected".

Apple's definitions (developer.apple.com/app-store/app-privacy-details/,
read 2026-11-14):

- "Data collected from an app is often linked to the user's identity, unless
  specific privacy protections are put in place before collection to
  de-identify or anonymize it." And: "'Personal Information' and 'Personal
  Data', as defined under relevant privacy laws, are considered linked to the
  user." The address kept with a random number per device is personal data
  in Europe and Brazil: everything below is **linked to the user**.
- "You collect and store IP address from your users. Declare the relevant
  data types based on how you use IP address, such as precise location,
  coarse location, device ID, or diagnostics." Ours gives the city: Coarse
  Location.
- "'Tracking' refers to linking data collected from your app about a
  particular end-user or device [...] with Third-Party Data for targeted
  advertising or advertising measurement purposes, or sharing data [...] with
  a data broker." None of it: **not used to track**.

| Data type | What it is here | Purpose | Linked | Tracking |
|---|---|---|---|---|
| Location, Coarse Location | the city from the address | Analytics | yes | no |
| Identifiers, Device ID | the random number per install | Analytics | yes | no |
| Usage Data, Product Interaction | pages, time on them, taps, sessions; on iPhone and iPad the replays | Analytics | yes | no |
| Usage Data, Other Usage Data | the choices in Settings: competitions, countries, apps, language | Analytics | yes | no |
| Diagnostics, Performance Data | the time from launch to the first board | Analytics | yes | no |
| Diagnostics, Other Diagnostic Data | a board that failed or went stale | Analytics | yes | no |
| Other Data, Other Data Types | locale, region, time zone, device model and system version | Analytics | yes | no |

The App Store page then reads "Data Linked to You" with those types, and no
"Data Used to Track You".

## Still open

- The App Privacy form is Julien's to fill, with the answers above.
- The store's description says "no tracking" (`docs/store-listing.md`, in
  its four languages, and `docs/store-release.md`): still true in Apple's
  sense of the word, but a reader may take it otherwise. Julien's to word.
- Europe for the data: a new project and key, as above, if Julien wants it.
