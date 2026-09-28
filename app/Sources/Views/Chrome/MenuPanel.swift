import SwiftUI

/// The menu, drawn after tvOS's own sidebar: shut, a chip at the top left
/// saying where you are; open, a rounded glass panel with Home, then each
/// family of sport under its heading, every competition with its mark.
///
/// Headings sit on the icon column, which tvOS's own never allowed.
struct MenuPanel: View {
    let sections: [(section: SportSection, leagues: [LeagueSummary])]
    let selection: MenuItem
    let expanded: Bool
    var focus: FocusState<MenuItem?>.Binding
    let pick: (MenuItem) -> Void

    var body: some View {
        if expanded {
            panel
                .transition(.move(edge: .leading).combined(with: .opacity))
        } else {
            chip
                .transition(.opacity)
        }
    }

    private var panel: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Metrics.menuRowGap) {
                // Where Apple Sports puts the viewer's picture, the app's
                // name: tvOS gives an app neither the profile's name nor its
                // picture (researched 2026-09-21), and the page above already
                // shows the day and time (Julien, 2026-09-28).
                Text("app.title")
                    .font(.system(size: Metrics.menuFont * 1.4, weight: .bold))
                    .padding(.horizontal, Metrics.menuRowInsetH)
                    .padding(.vertical, Metrics.menuRowInsetV)
                row(.home, title: Text("tab.home"), icon: .symbol("house.fill"), id: "menu.home")
                ForEach(sections, id: \.section.id) { entry in
                    Text(entry.section.title)
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.leading, Metrics.menuRowInsetH)
                        .padding(.top, Metrics.menuRowGap * 2)
                    ForEach(entry.leagues) { league in
                        row(.league(Sidebar.key(league)), title: Text(verbatim: league.menu),
                            icon: .league(league), id: "menu.\(league.sport).\(league.id.raw)")
                    }
                }
            }
            .padding(Metrics.menuInset)
        }
        .scrollClipDisabled()
        .frame(width: Metrics.menuWidth)
        .frame(maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: Metrics.menuRadius, style: .continuous).fill(.regularMaterial))
        .clipShape(RoundedRectangle(cornerRadius: Metrics.menuRadius, style: .continuous))
        .shadow(color: .black.opacity(0.35), radius: 30, x: 0, y: 10)
        .padding(Metrics.menuMargin)
        .ignoresSafeArea()
        .focusSection()
        // No Back handler here on purpose: Back in the open menu leaves the
        // app, as it does from tvOS's own sidebar — the way out of an app
        // that App Review checks for.
    }

    private func row(_ item: MenuItem, title: Text, icon: MenuIcon, id: String) -> some View {
        Button { pick(item) } label: {
            MenuRow(title: title, icon: icon, current: item == selection)
        }
        // A style of ours: tvOS's borderless style blows a symbol inside a
        // button up to its own size, which made Home's house twice a crest.
        .buttonStyle(MenuRowStyle())
        .focusEffectDisabled()
        .focused(focus, equals: item)
        .accessibilityIdentifier(id)
    }

    /// Shut: where you are, as the collapsed system sidebar shows it.
    private var chip: some View {
        HStack(spacing: 10) {
            Image(systemName: "chevron.left")
                .font(.caption.weight(.semibold))
            currentIcon.view(size: Metrics.menuIcon * 0.8)
            currentTitle
                .font(.callout.weight(.semibold))
                .lineLimit(1)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .background(Capsule().fill(.regularMaterial))
        .padding(Metrics.menuMargin)
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityIdentifier("menu.chip")
    }

    private var currentLeague: LeagueSummary? {
        guard case .league(let key) = selection else { return nil }
        return sections.flatMap(\.leagues).first { Sidebar.key($0) == key }
    }

    private var currentTitle: Text {
        currentLeague.map { Text(verbatim: $0.menu) } ?? Text("tab.home")
    }

    private var currentIcon: MenuIcon {
        currentLeague.map { .league($0) } ?? .symbol("house.fill")
    }
}

/// What stands before a row's name: a system symbol, or a competition's mark.
enum MenuIcon {
    case symbol(String)
    case league(LeagueSummary)

    @ViewBuilder
    func view(size: CGFloat) -> some View {
        switch self {
        case .symbol(let name):
            Image(systemName: name)
                .font(.system(size: size * 0.7, weight: .semibold))
                .frame(width: size, height: size)
        case .league(let league):
            CachedImage(url: league.icon ?? league.logo) {
                Image(systemName: league.symbol ?? Sport.icon(for: league.sport))
                    .font(.system(size: size * 0.6))
                    .foregroundStyle(Sport.tint(for: league.sport))
            }
            .frame(width: size, height: size)
        }
    }
}

private struct MenuRow: View {
    let title: Text
    let icon: MenuIcon
    let current: Bool
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        HStack(spacing: 16) {
            icon.view(size: Metrics.menuIcon)
                .environment(\.onLightSurface, isFocused)
            // Long names fade out at the panel's edge, as tvOS's own
            // sidebar does, rather than end in an ellipsis.
            title
                .font(.system(size: Metrics.menuFont, weight: .medium))
                .lineLimit(1)
                .fixedSize()
                .frame(maxWidth: .infinity, alignment: .leading)
                .mask(LinearGradient(stops: [.init(color: .black, location: 0.85), .init(color: .clear, location: 1)],
                                     startPoint: .leading, endPoint: .trailing))
        }
        .foregroundStyle(isFocused ? Color.black : Color.primary)
        .padding(.vertical, Metrics.menuRowInsetV)
        .padding(.horizontal, Metrics.menuRowInsetH)
        .background(Capsule().fill(isFocused ? Color.white : Color.white.opacity(current ? 0.16 : 0)))
        .scaleEffect(isFocused ? 1.04 : 1)
        .animation(.easeOut(duration: 0.15), value: isFocused)
    }
}

/// A button that draws nothing of its own: the row says focus itself.
private struct MenuRowStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
    }
}
