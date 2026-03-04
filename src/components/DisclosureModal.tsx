import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

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
  visible,
  icon,
  title,
  message,
  acceptLabel,
  cancelLabel,
  onAccept,
  onCancel,
}: DisclosureModalProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          {icon && <View style={styles.iconContainer}>{typeof icon === 'string' ? <Text style={styles.iconText}>{icon}</Text> : icon}</View>}
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          <View style={styles.buttons}>
            {cancelLabel && onCancel && (
              <Pressable
                style={({ pressed }) => [styles.button, styles.cancelButton, { borderColor: colors.inputBorder, opacity: pressed ? 0.7 : 1 }]}
                onPress={onCancel}
              >
                <Text style={[styles.buttonText, { color: colors.textSecondary }]}>{cancelLabel}</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [styles.button, styles.acceptButton, { backgroundColor: colors.primaryBlue, opacity: pressed ? 0.7 : 1 }, cancelLabel ? {} : { flex: 1 }]}
              onPress={onAccept}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>{acceptLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  card: {
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 12,
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1.5,
  },
  acceptButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
