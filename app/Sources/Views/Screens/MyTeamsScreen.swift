import SwiftUI

/// My Teams: only the followed sides' games, by Yesterday, Today and
/// Upcoming, as Apple Sports' own view of the same name (Julien,
/// 2026-11-15). Reached from the menu, and from Home's "★ My Teams ›".
struct MyTeamsScreen: View {
    let store: ScoreboardStore
    @Binding var day: Day
    /// Opens the picker, over the page.
    let chooseTeams: () -> Void
    @State private var favourites = Favourites.shared
    #if os(tvOS)
    @Environment(\.openMenu) private var openMenu
    #endif

    var body: some View {
        BoardPage {
            #if os(tvOS)
            HStack(alignment: .firstTextBaseline) {
                Text("myTeams.title")
                    .font(.system(size: .tv(46), weight: .bold))
                Spacer()
                if !favourites.isEmpty {
                    Button(action: chooseTeams) { Label("myTeams.choose", systemImage: "star") }
                        .accessibilityIdentifier("myTeams.edit")
                }
            }
            // One place for focus, the width of the page: a press up from the
            // day switch reaches the button at the far right, which nothing
            // under it lines up with (Julien, build 58: "I cannot go to my
            // team's choose teams button").
            .focusSection()
            #endif
            BoardCard(day: $day) { content }
        }
        .usagePage(.myTeams(day))
        .onChange(of: day) { _, picked in Analytics.shared.track(.dayPicked(picked, on: "my teams")) }
        .accessibilityIdentifier("page.myTeams")
        #if os(tvOS)
        .onExitCommand(perform: openMenu)
        #else
        .navigationTitle(Text("myTeams.title"))
        .toolbar {
            if !favourites.isEmpty {
                // A word: a star there read as a second one (Julien, build 55).
                Button(action: chooseTeams) { Text("myTeams.edit").fontWeight(.semibold) }
                    .accessibilityIdentifier("myTeams.edit")
            }
        }
        #endif
    }

    @ViewBuilder
    private var content: some View {
        if favourites.isEmpty {
            FollowPrompt(choose: chooseTeams)
        } else if let board = store.board {
            let games = favourites.games(in: board.groups(for: day))
            if games.isEmpty {
                EmptyDay(title: Text("myTeams.none"), line: nil)
            } else {
                FollowedSection(games: games, day: day, now: board.generatedAt)
                    .padding(.top, .tv(4))
            }
        } else {
            ProgressView("home.loading")
                .frame(maxWidth: .infinity, minHeight: .tv(500))
        }
    }
}
