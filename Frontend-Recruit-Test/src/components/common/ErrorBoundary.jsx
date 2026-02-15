"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * ErrorBoundary — Catches unhandled errors in child components
 * and renders a "Something went wrong" fallback UI.
 *
 * Catches both render-time errors (via componentDidCatch) and
 * provides a "Try Again" button that resets the boundary.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to structured console (could forward to a monitoring service)
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Allow a custom fallback via props
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          reset: this.handleReset,
        });
      }

      // Default "Something went wrong" UI
      return (
        <div className="flex items-center justify-center min-h-[60vh] px-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-8 max-w-lg w-full text-center">
            {/* Icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-5">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Something went wrong
            </h2>

            {/* Description */}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              An unexpected error occurred while rendering this page.
              {this.state.error?.message?.includes("500") &&
                " The server encountered an internal error during an upload transaction."}
            </p>

            {/* Error details (collapsed) */}
            {this.state.error?.message && (
              <details className="mb-5 text-left">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs text-red-600 dark:text-red-400 overflow-auto max-h-32 whitespace-pre-wrap break-words">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = "/user")}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
