import React from 'react';

// Keep failures in one document renderer from unmounting the header, History,
// and recovery controls. Changing comparison or view resets the boundary so a
// failure in one version pair cannot trap the next comparison in this state.
class ComparisonErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="dh-comparison-error" role="alert">
          <h2>The comparison could not be displayed.</h2>
          <p>Your recovery choices are still available. Retry the renderer or select another version.</p>
          <button onClick={() => this.setState({ hasError: false })} type="button">
            Retry comparison
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ComparisonErrorBoundary;
