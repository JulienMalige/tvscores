# The iPhone and iPad app, 2026-11-12

Julien, on 12 November 2026: "can we build the ios app?", then, on the plan
(the same sources, the same App Store page, first pictures from the simulator,
then TestFlight): "lets do it".

## One app, two platforms

- **The same sources.** `app/Sources` builds twice: target `TVScores` for tvOS,
  target `TVScoresiOS` (scheme of the same name) for iPhone and iPad. Nothing is
  forked, so a feature lands on both; what one platform alone has sits behind
  `#if os(tvOS)` or `#if os(iOS)`.
- **Sizes.** The television's numbers were measured as Apple Sports' iPhone
  sizes doubled (`docs/design-measures.md`, k = 2), so on iOS `.tv()` halves
  them and the phone gets Apple's own. Where half does not fit a phone's width
  it is given outright (`.tv(180, phone: 66)`): the match row's columns, the
  game page's header, a race's result columns. The system's text styles are
  already sized per platform.
- **Navigation.** The television's menu becomes the system's split view
  (`SplitMenu`): its list is the menu (Home, each family of sport with its
  competitions, the gear on top). On an iPhone the page comes first and the
  list is one step back, as the menu is one press left on the television; on
  an iPad the list stands beside the page. A competition opened from Home is
  pushed over it, as a phone goes deeper, where the television moves the
  menu's selection. A game or a race rises on the system's sheet.
- **Settings** is a navigation stack of the same lists, with Done.
- **Dark only**, as Apple Sports: every page is drawn on a dark tint.
- **The television's only:** the remote's focus and Back, the menu panel and
  its chip, and the focus trace (`Diagnostics` posts nothing from iOS).
- **Icon.** The same court as one opaque 1024-point square
  (`scripts/make-brand-assets.py`, `app/iOS/Assets.xcassets`).

## The App Store

- **One product page.** The iPhone app takes the television's bundle id,
  `com.julienmalige.tvscores`: Apple's universal purchase, one app record for
  Apple TV, iPhone and iPad, each platform with its own version and builds.
- **Before TestFlight:** Julien adds iOS to TV Scores in App Store Connect
  ("Add Platform", on the web). The TestFlight workflow then needs an iOS
  archive, and an App Store profile for iOS beside the tvOS one.
- **Before the store:** iPhone and iPad screenshots; the privacy pages (four
  languages) and the store's copy name the iPhone and the iPad. The App Privacy
  answers stay as they are while the phone sends what the television sends.

## Later

Widgets; scores on the Lock Screen (Live Activities, which need the proxy to
push through Apple's notification service); a team's games as notifications.
