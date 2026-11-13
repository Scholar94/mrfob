import React from "react";

export default class PortalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("MR FOP account portal render failure:", error, info?.componentStack || "");
  }

  render() {
    if (this.state.hasError) {
      return <section className="portal-render-error" role="alert" aria-live="assertive">
        <div className="portal-render-error-mark" aria-hidden="true">!</div>
        <h2>The account section could not be displayed</h2>
        <p>Your account data has not been intentionally changed by this display error. Close this window and sign in again. If the problem continues, contact MR FOP support and report that the account portal encountered a display error.</p>
        <div className="portal-render-error-actions">
          <button type="button" onClick={() => this.setState({ hasError: false })}>Try loading again</button>
          <button type="button" onClick={this.props.onClose}>Close account</button>
        </div>
      </section>;
    }
    return this.props.children;
  }
}
