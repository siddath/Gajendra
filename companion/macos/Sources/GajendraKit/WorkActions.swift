import SwiftUI

/// The provider owns the conversation; these explicit actions change only Gajendra's work map.
struct GajendraWorkActions: View {
    @ObservedObject var model: DeckViewModel
    let thread: DeckThread
    @State private var choosingContinuation = false
    @State private var query = ""

    var body: some View {
        Menu {
            if thread.currentThreadId == thread.id {
                Button(thread.workState == "completed" ? "Reopen work" : "Finish work") {
                    model.apply(.setWorkCompleted(threadId: thread.id, completed: thread.workState != "completed"),
                                actionName: thread.workState == "completed" ? "Reopen work" : "Finish work")
                }
                if thread.workState != "completed" {
                    Button("Choose continuation…") { choosingContinuation = true }
                }
            } else {
                Button("Open current continuation") {
                    if let current = model.snapshot?.allThreads.first(where: { $0.id == thread.currentThreadId }) {
                        model.open(current)
                    }
                }
                if thread.continuationThreadId == thread.currentThreadId {
                    Button("Unlink continuation") {
                        model.apply(.linkContinuation(threadId: thread.id, currentThreadId: nil), actionName: "Unlink continuation")
                    }
                }
            }
        } label: { Text("More") }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .disabled(model.isMutating || model.snapshot?.cachedAt != nil)
        .accessibilityLabel("Work actions for \(thread.title)")
        .popover(isPresented: $choosingContinuation) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Choose continuation").font(.headline)
                Text("Move this work’s priority and NOW to the exact chat you choose.")
                    .font(.caption).foregroundStyle(.secondary)
                TextField("Search chats by title, project, or ID", text: $query)
                    .textFieldStyle(.roundedBorder)
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(candidates) { candidate in
                            Button {
                                model.apply(.linkContinuation(threadId: thread.id, currentThreadId: candidate.id),
                                            actionName: "Link continuation")
                                choosingContinuation = false
                            } label: {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(candidate.title).lineLimit(2)
                                    Text("\(candidate.sourceName) · \(candidate.project)")
                                        .font(.caption).foregroundStyle(.secondary)
                                    Text(candidate.id).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                                }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 9)
                                    .contentShape(Rectangle())
                            }.buttonStyle(.plain)
                            Divider()
                        }
                    }
                }.frame(height: 240)
                if candidates.isEmpty { Text("No matching chats").foregroundStyle(.secondary) }
                Button("Cancel") { choosingContinuation = false }
            }.padding(16).frame(width: 360)
        }
    }

    private var candidates: [DeckThread] {
        Array((model.snapshot?.searchThreads(query) ?? []).filter {
            $0.id != thread.id && $0.currentThreadId == $0.id && $0.workState != "completed" && $0.level == nil
                && $0.predecessorThreadIds.isEmpty
                && !thread.predecessorThreadIds.contains($0.id)
        }.prefix(50))
    }
}
