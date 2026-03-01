import React from 'react';

type AlertType = 'high_load' | 'increasing_backlog' | 'declining_responsiveness' | 'untriaged_issues';
type AlertSeverity = 'low' | 'medium' | 'high';

interface BurnoutAlert {
  type: AlertType;
  severity: AlertSeverity;
  affected_maintainers: string[];
  metric_value: number;
  threshold: number;
  message: string;
  timestamp: string;
}

interface BurnoutAlertsPanelProps {
  alerts: BurnoutAlert[];
}

export const BurnoutAlertsPanel: React.FC<BurnoutAlertsPanelProps> = ({ alerts }) => {
  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getAlertTypeLabel = (type: AlertType) => {
    switch (type) {
      case 'high_load':
        return 'High Load Concentration';
      case 'increasing_backlog':
        return 'Increasing Backlog';
      case 'declining_responsiveness':
        return 'Declining Responsiveness';
      case 'untriaged_issues':
        return 'Untriaged Issues';
      default:
        return type;
    }
  };

  const getAlertIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'high':
        return '🔴';
      case 'medium':
        return '🟡';
      case 'low':
        return '🔵';
      default:
        return '⚪';
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Burnout Alerts</h3>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-gray-600">No active burnout alerts</p>
            <p className="text-sm text-gray-500 mt-1">All metrics are within healthy ranges</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Burnout Alerts
        <span className="ml-2 text-sm font-normal text-gray-500">({alerts.length} active)</span>
      </h3>
      <div className="space-y-4">
        {alerts.map((alert, index) => (
          <div
            key={index}
            className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{getAlertIcon(alert.severity)}</span>
                  <h4 className="font-semibold">{getAlertTypeLabel(alert.type)}</h4>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded uppercase ${getSeverityColor(
                      alert.severity
                    )}`}
                  >
                    {alert.severity}
                  </span>
                </div>
                <p className="text-sm mb-2">{alert.message}</p>
                <div className="text-xs space-y-1">
                  {alert.affected_maintainers.length > 0 && (
                    <div>
                      <span className="font-medium">Affected maintainers:</span>{' '}
                      {alert.affected_maintainers.join(', ')}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Metric value:</span> {alert.metric_value.toFixed(2)}{' '}
                    <span className="text-gray-600">(threshold: {alert.threshold.toFixed(2)})</span>
                  </div>
                  <div>
                    <span className="font-medium">Detected:</span>{' '}
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
