import { useRef, useEffect, type CSSProperties } from "react";
import { ClientRuntime, RendererType, type IApplication } from "@utsp/runtime-client";
import "./UTSPClient.css";

// =============================================================================
// Types
// =============================================================================

interface UTSPClientProps {
    /** The UTSP Application instance to run */
    application: IApplication;
    /** Renderer type (default: Terminal2D) */
    renderer?: RendererType;
    /** Grid width in cells (default: 80) */
    width?: number;
    /** Grid height in cells (default: 24) */
    height?: number;
    /** Additional CSS class */
    className?: string;
    /** Inline styles */
    style?: CSSProperties;
    /** Whether to enable autoplay (default: true) */
    autoplay?: boolean;
}

// =============================================================================
// Component
// =============================================================================

/**
 * UTSPClient - React wrapper for the UTSP ClientRuntime
 *
 * This component handles the lifecycle of a UTSP application including:
 * - Initialization and cleanup of the ClientRuntime
 * - Protection against React Strict Mode double-invocation
 * - Hot Module Replacement (HMR) support for development
 *
 * @example
 * ```tsx
 * import { SpaceDemo } from "./applications/SpaceDemo";
 *
 * <UTSPClient
 *     application={new SpaceDemo()}
 *     width={120}
 *     height={40}
 * />
 * ```
 */
const UTSPClient: React.FC<UTSPClientProps> = ({
    application,
    renderer = RendererType.TerminalGL,
    width = 80,
    height = 24,
    className = "",
    style,
    autoplay = true,
}) => {
    // -------------------------------------------------------------------------
    // Refs
    // -------------------------------------------------------------------------

    /** Reference to the container div where the runtime will render */
    const containerRef = useRef<HTMLDivElement>(null);

    /** Reference to the current ClientRuntime instance */
    const runtimeRef = useRef<ClientRuntime | null>(null);

    /**
     * Tracks the dependency key used during initialization.
     * This allows us to distinguish between:
     * - React Strict Mode re-runs (same key → skip initialization)
     * - Real dependency changes / HMR (different key → reinitialize)
     */
    const initializedWithKeyRef = useRef<string | null>(null);

    // -------------------------------------------------------------------------
    // Dependency tracking for HMR
    // -------------------------------------------------------------------------

    /**
     * Unique key generated from all dependencies.
     * When this key changes, we know the dependencies have truly changed
     * (not just a Strict Mode re-run) and we should reinitialize.
     */
    const depsKey = `${application.constructor.name}-${renderer}-${width}-${height}-${autoplay}`;

    // -------------------------------------------------------------------------
    // Lifecycle Effect
    // -------------------------------------------------------------------------

    useEffect(() => {
        // Guard: Wait for container to be mounted
        if (!containerRef.current) return;

        // =====================================================================
        // STRICT MODE PROTECTION
        // =====================================================================
        // In React Strict Mode (development), effects run twice:
        // mount → unmount → mount. We skip the second initialization if
        // the dependencies haven't actually changed.
        if (initializedWithKeyRef.current === depsKey) {
            return;
        }

        // =====================================================================
        // HMR CLEANUP
        // =====================================================================
        // If a runtime already exists (HMR triggered with new deps),
        // we need to properly clean it up before creating a new one.
        if (runtimeRef.current) {
            runtimeRef.current.stop();
            runtimeRef.current = null;
        }

        // Clear any leftover DOM elements (canvas, etc.) from previous runtime
        // to prevent visual stacking during HMR.
        containerRef.current.innerHTML = "";

        // Mark as initialized with current deps key
        initializedWithKeyRef.current = depsKey;

        // =====================================================================
        // RUNTIME INITIALIZATION
        // =====================================================================

        const runtime = new ClientRuntime({
            mode: "standalone",
            standalone: {
                application,
            },
            container: containerRef.current,
            renderer,
            width,
            height,
            autoplay,
        });

        runtimeRef.current = runtime;
        runtime.start();

        // =====================================================================
        // CLEANUP (on unmount or dependency change)
        // =====================================================================

        return () => {
            if (runtimeRef.current) {
                runtimeRef.current.stop();
                runtimeRef.current = null;
            }
            // Reset the key so a fresh mount will initialize properly
            initializedWithKeyRef.current = null;
        };
    }, [application, renderer, width, height, autoplay, depsKey]);

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------

    return (
        <div
            ref={containerRef}
            className={`utsp-client ${className}`}
            style={style}
        />
    );
};

export default UTSPClient;
