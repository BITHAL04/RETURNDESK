"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { EventDto, NoteDto, RequestDto } from "@/server/requests/serialize";

export type RequestDetail = RequestDto & { notes: NoteDto[]; history: EventDto[] };

type State =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "error"; message: string }
  | { kind: "ready"; request: RequestDetail };

/** Loads a request with its notes and history from the API, and exposes a refresh. */
export function useRequest(id: string) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiFetch<RequestDetail>(`/api/requests/${id}`)
      .then(({ data }) => !cancelled && setState({ kind: "ready", request: data }))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiClientError && error.status === 404)
          setState({ kind: "not-found" });
        else
          setState({
            kind: "error",
            message: error instanceof Error ? error.message : "Could not load request.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { state, refresh, setState };
}
