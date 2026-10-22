export interface ContentController {
  destroy(): void;
}

interface LifecycleOptions {
  stopPage: () => void;
  removeListeners: readonly (() => void)[];
  clearSingleton: () => void;
}

function safely(cleanup: () => void): void {
  try {
    cleanup();
  } catch {
    // Reloading an extension invalidates old API objects. Cleanup must still
    // remove page effects and continue to the remaining independent resources.
  }
}

export function retireContentController(previous: ContentController | undefined): void {
  if (previous) safely(() => previous.destroy());
}

export function createContentController(options: LifecycleOptions): ContentController {
  let destroyed = false;
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      // Native DOM/timer cleanup comes before extension APIs, which may throw.
      safely(options.stopPage);
      options.removeListeners.forEach(safely);
      safely(options.clearSingleton);
    },
  };
}
