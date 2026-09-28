import SwiftUI

/// One race: the podium, then the full classification.
struct RaceScreen: View {
    let eventId: String
    /// What the row showed when it was tapped, used until the store answers.
    let fallback: Event
    let store: ScoreboardStore

    /// Re-read from the store on every pass: the page outlives a refresh, so a
    /// race in progress keeps moving and portraits resolved later turn up.
    private var event: Event { store.board?.find(eventId)?.event ?? fallback }

    private var results: [RaceResult] { event.results ?? [] }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Metrics.sectionGap * 0.75) {
                header
                if results.filter(\.finished).isEmpty {
                    // Nothing classified yet: the weekend ahead, when the
                    // feed has it.
                    if let sessions = event.sessions, !sessions.isEmpty {
                        SessionSection(sessions: sessions)
                    } else {
                        Text("home.empty")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.top, 80)
                    }
                } else {
                    PodiumSection(results: results)
                    ResultSection(results: results)
                }
                // When and where, as Apple Sports gives a race: the circuit
                // and its country.
                GameInfoSection(start: event.start, venue: event.circuit, place: event.country)
            }
            .pageMargins()
        }
    }

    private var header: some View {
        HStack(spacing: 24) {
            FlagMark(flag: event.flag, size: Metrics.markHero)
            VStack(alignment: .leading, spacing: 8) {
                Text(event.name ?? "")
                    .font(.system(size: 48, weight: .bold))
                Text([event.circuit, event.country].compactMap { $0 }.joined(separator: " · "))
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            StatusLabel(status: event.status, start: event.start)
        }
    }
}
