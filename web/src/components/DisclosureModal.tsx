import './DisclosureModal.css';

interface DisclosureModalProps {
  visible: boolean;
  icon?: React.ReactNode;
  title: string;
  message: string;
  acceptLabel: string;
  cancelLabel?: string;
  onAccept: () => void;
  onCancel?: () => void;
}

export default function DisclosureModal({
  visible, icon, title, message, acceptLabel, cancelLabel, onAccept, onCancel,
}: DisclosureModalProps) {
  if (!visible) return null;

  return (
    <div className="disclosure-overlay">
      <div className="disclosure-card">
        {icon && <div className="disclosure-icon">{icon}</div>}
        <h2 className="disclosure-title">{title}</h2>
        <p className="disclosure-message">{message}</p>
        <div className="disclosure-buttons">
          {cancelLabel && onCancel && (
            <button className="disclosure-btn disclosure-cancel" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button className="disclosure-btn disclosure-accept" onClick={onAccept}>
            {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
