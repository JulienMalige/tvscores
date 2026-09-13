import SwiftUI

/// Day-0 placeholder: proves the build, the focus engine and the four
/// localisations. Replaced by the real Today screen in the next step.
struct HomeView: View {
    @State private var selected: Section = .today

    enum Section: String, CaseIterable, Identifiable {
        case today, week
        var id: String { rawValue }
        var title: LocalizedStringKey {
            switch self {
            case .today: "section.today"
            case .week: "section.week"
            }
        }
    }

    var body: some View {
        VStack(spacing: 48) {
            Text("app.title")
                .font(.system(size: 76, weight: .bold))
            Text(Date.now, format: .dateTime.weekday(.wide).day().month(.wide))
                .font(.title2)
                .foregroundStyle(.secondary)
            HStack(spacing: 32) {
                ForEach(Section.allCases) { section in
                    Button(section.title) { selected = section }
                        .buttonStyle(.bordered)
                        .tint(selected == section ? .accentColor : .secondary)
                }
            }
            Text("home.empty")
                .font(.title3)
                .foregroundStyle(.secondary)
                .padding(.top, 24)
        }
        .padding(80)
    }
}

#Preview {
    HomeView()
}
