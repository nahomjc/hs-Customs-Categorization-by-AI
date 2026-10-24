"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { JobApiError, type BatchJobLike, type JobStatus } from "./job-progress";

/** POST JSON to an import-case endpoint; errors carry the HTTP status. */
export async function postJobRequest<T>(
  url: string,
  body: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // no status => treated as a network error and retried once
    throw new JobApiError("Network error. Check your connection.");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body
  }
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new JobApiError(message, res.status);
  }
  return data as T;
}

type Options<S> = {
  /** Called whenever a run ends (success, stopped, partial or failed). */
  onFinished?: (snapshot: S) => void;
};

/**
 * React wrapper for any BatchJobLike: owns the job, mirrors its snapshot into
 * state, warns before leaving the page while it runs, and stops it cleanly
 * (after the current batch) when the tab unmounts.
 */
export function useBatchJob<S extends { status: JobStatus }>(
  createJob: (onUpdate: (snapshot: S) => void) => BatchJobLike<S>,
  options: Options<S> = {},
) {
  const jobRef = useRef<BatchJobLike<S> | null>(null);
  const finishedRef = useRef(options.onFinished);
  const createRef = useRef(createJob);
  const [snapshot, setSnapshot] = useState<S | null>(null);

  useEffect(() => {
    finishedRef.current = options.onFinished;
    createRef.current = createJob;
  });

  const active = snapshot?.status === "running" || snapshot?.status === "stopping";

  // Warn before closing or reloading the tab while work is in flight.
  useEffect(() => {
    if (!active) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);

  // Leaving the tab stops the loop cleanly after the current batch. Finished
  // items are kept; the run is resumable by starting it again.
  useEffect(() => {
    return () => {
      jobRef.current?.requestStop();
    };
  }, []);

  const track = useCallback((promise: Promise<S>) => {
    void promise.then((final) => finishedRef.current?.(final));
  }, []);

  const start = useCallback(() => {
    if (jobRef.current?.isRunning) return;
    const job = createRef.current(setSnapshot);
    jobRef.current = job;
    setSnapshot(job.snapshot());
    track(job.run());
  }, [track]);

  const resume = useCallback(() => {
    const job = jobRef.current;
    if (job && !job.isRunning) track(job.run());
  }, [track]);

  const retryFailed = useCallback(() => {
    const job = jobRef.current;
    if (job && !job.isRunning) track(job.retryFailed());
  }, [track]);

  const stop = useCallback(() => {
    jobRef.current?.requestStop();
  }, []);

  const reset = useCallback(() => {
    if (jobRef.current?.isRunning) return;
    jobRef.current = null;
    setSnapshot(null);
  }, []);

  return { snapshot, active, start, resume, retryFailed, stop, reset };
}