import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

/**
 * AtheneState represents the flattened graph state.
 * Root-level orgId, userId, and role are required for RLS tool extraction.
 */
export const AtheneState = Annotation.Root({
  ...MessagesAnnotation.spec,
  orgId: Annotation<string>(),
  userId: Annotation<string>(),
  role: Annotation<string>(),
  next: Annotation<string>(),
  retrievedDocs: Annotation<any[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

export type AtheneStateType = typeof AtheneState.State;
